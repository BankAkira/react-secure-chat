import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { ChakraProvider, Box, Flex, VStack, Heading, Text, Input, Button, useToast, 
  Tabs, TabList, TabPanels, Tab, TabPanel, Avatar, Divider, List, ListItem } from '@chakra-ui/react';
import { AESGCM, PBKDF2, ECCUtils, ShamirSecretSharing, IPFSService } from './services';
import ECCOperationsABI from './contracts/ECCOperations.json';
import KeyShareRegistryABI from './contracts/KeyShareRegistry.json';

// Contract addresses - replace with your deployed contract addresses
const ECC_OPERATIONS_ADDRESS = '0x2F21Db7415cD94A3065ACCb00AE6e1AF3752c838';
const KEY_SHARE_REGISTRY_ADDRESS = '0x4E1A1F818ca4113B26482dEd4290Da65aAf61CFb';

// Define interface for message
interface Message {
  id: string;
  sender: string;
  sender_id: string;
  recipient: string;
  timestamp: number;
  cid: string;
  content?: string;
  direction: 'sent' | 'received';
}

// Interface for contact
interface Contact {
  address: string;
  user_id: string;
  last_interaction: number;
}

function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [eccContract, setEccContract] = useState<ethers.Contract | null>(null);
  const [keyShareContract, setKeyShareContract] = useState<ethers.Contract | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [newMessage, setNewMessage] = useState<string>('');
  const [recipientAddress, setRecipientAddress] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const toast = useToast();

  // Initialize ethers provider and contracts
  useEffect(() => {
    const initProvider = async () => {
      if (window.ethereum) {
        try {
          const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
          setProvider(web3Provider);
          
          const eccOps = new ethers.Contract(
            ECC_OPERATIONS_ADDRESS,
            ECCOperationsABI.abi,
            web3Provider.getSigner()
          );
          setEccContract(eccOps);
          
          const keyShare = new ethers.Contract(
            KEY_SHARE_REGISTRY_ADDRESS,
            KeyShareRegistryABI.abi,
            web3Provider.getSigner()
          );
          setKeyShareContract(keyShare);
          
          // Load account
          const accounts = await web3Provider.listAccounts();
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            
            // Load message history from local storage
            loadMessagesAndContacts();
          }
        } catch (err) {
          console.error("Error initializing provider:", err);
          toast({
            title: "Connection Error",
            description: "Failed to connect to Ethereum network",
            status: "error",
            duration: 5000,
            isClosable: true,
          });
        }
      } else {
        toast({
          title: "Web3 Not Found",
          description: "Please install MetaMask to use this application",
          status: "warning",
          duration: 5000,
          isClosable: true,
        });
      }
    };

    initProvider();
  }, [toast]);

  // Connect wallet
  const connectWallet = async () => {
    if (!provider) return;
    
    try {
      setIsLoading(true);
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const accounts = await provider.listAccounts();
      setAccount(accounts[0]);
      
      toast({
        title: "Wallet Connected",
        description: `Connected to ${accounts[0].substring(0, 6)}...${accounts[0].substring(38)}`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      console.error("Error connecting wallet:", err);
      toast({
        title: "Connection Failed",
        description: "Failed to connect wallet",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize user with key generation and registration
  const initializeUser = async () => {
    if (!account || !eccContract || !keyShareContract || !provider || !userId) {
      toast({
        title: "Initialization Error",
        description: "Please connect wallet and set user ID first",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setIsLoading(true);
      
      // Generate ECC key pair
      const { privateKeyBytes, publicKeyBytes } = await ECCUtils.generateKeyPair();
      
      // Get recovery password
      const recoveryPassword = prompt("Enter a recovery password for your keys:");
      if (!recoveryPassword) {
        toast({
          title: "Setup Cancelled",
          description: "Recovery password is required",
          status: "warning",
          duration: 3000,
          isClosable: true,
        });
        setIsLoading(false);
        return;
      }
      
      // Split private key using Shamir's Secret Sharing
      const numShares = 5;
      const threshold = 3;
      const shares = ShamirSecretSharing.splitSecret(privateKeyBytes, numShares, threshold);
      
      // Encrypt shares
      const encryptedShares = await Promise.all(
        shares.map(share => {
          return AESGCM.encryptShare(share, recoveryPassword);
        })
      );
      
      // Register public key on blockchain
      const registerTx = await eccContract.registerPublicKey(publicKeyBytes);
      await registerTx.wait();
      
      // Store key shares on blockchain
      const shareTx = await keyShareContract.storeShares(encryptedShares, numShares, threshold);
      await shareTx.wait();
      
      // Store initialization info securely in localStorage
      const initData = {
        userId,
        address: account,
        initialized: true,
        publicKey: ethers.utils.hexlify(publicKeyBytes),
        // Don't store private key directly
      };
      localStorage.setItem('secureChat_userData', JSON.stringify(initData));
      
      setIsInitialized(true);
      
      toast({
        title: "Setup Complete",
        description: "Your secure chat identity has been created",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      
      // Save a reference to the key in localStorage (in a real app, use a more secure method)
      localStorage.setItem('secureChat_recovery', JSON.stringify({
        numShares,
        threshold,
        // Don't store password
      }));
      
    } catch (err) {
      console.error("Error initializing user:", err);
      toast({
        title: "Setup Failed",
        description: "Failed to initialize user",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load messages and contacts from local storage
  const loadMessagesAndContacts = () => {
    try {
      // Load user data
      const userData = localStorage.getItem('secureChat_userData');
      if (userData) {
        const data = JSON.parse(userData);
        setUserId(data.userId);
        setIsInitialized(data.initialized || false);
      }
      
      // Load messages
      const storedMessages = localStorage.getItem('secureChat_messages');
      if (storedMessages) {
        setMessages(JSON.parse(storedMessages));
      }
      
      // Load contacts
      const storedContacts = localStorage.getItem('secureChat_contacts');
      if (storedContacts) {
        setContacts(JSON.parse(storedContacts));
      }
    } catch (err) {
      console.error("Error loading data from localStorage:", err);
    }
  };

  // Send a message
  const sendMessage = async () => {
    if (!selectedContact && !recipientAddress) {
      toast({
        title: "No Recipient",
        description: "Please select a contact or enter a recipient address",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    if (!newMessage.trim()) {
      toast({
        title: "Empty Message",
        description: "Please enter a message to send",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    const recipientAddr = selectedContact ? selectedContact.address : recipientAddress;
    
    try {
      setIsLoading(true);
      
      // 1. Get recipient's public key
      const recipientPublicKey = await eccContract.getPublicKey(recipientAddr);
      
      // 2. Generate ephemeral key pair
      const { privateKeyBytes: ephemeralPrivate, publicKeyBytes: ephemeralPublic } = await ECCUtils.generateKeyPair();
      
      // 3. Compute shared key through blockchain
      const computeTx = await eccContract.computeSharedKey(recipientAddr, ephemeralPublic);
      const receipt = await computeTx.wait();
      
      // Extract keyId from event logs
      const event = receipt.events?.find(e => e.event === 'SharedKeyComputed');
      if (!event) {
        throw new Error("Failed to extract keyId from transaction logs");
      }
      const keyId = event.args.keyId;
      
      // 4. Derive encryption key from keyId
      const key = await PBKDF2.deriveKey(keyId, 'SecureChatSystem');
      
      // 5. Encrypt message
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encryptedData = await AESGCM.encrypt(key, iv, newMessage);
      
      // 6. Prepare the encrypted message object
      const messageObj = {
        key_id: keyId,
        sender_address: account,
        sender_id: userId,
        recipient_address: recipientAddr,
        iv: Array.from(iv),
        ciphertext: Array.from(new Uint8Array(encryptedData)),
        ephemeral_key: Array.from(ephemeralPublic),
        timestamp: Date.now(),
        message_type: "text/plain"
      };
      
      // 7. Store encrypted message on IPFS
      const cid = await IPFSService.addJSON(messageObj);
      
      // 8. Update message history
      const newMsg: Message = {
        id: `${account}-${recipientAddr}-${Date.now()}`,
        sender: account!,
        sender_id: userId,
        recipient: recipientAddr,
        timestamp: Date.now(),
        cid,
        content: newMessage,
        direction: 'sent'
      };
      
      const updatedMessages = [...messages, newMsg];
      setMessages(updatedMessages);
      localStorage.setItem('secureChat_messages', JSON.stringify(updatedMessages));
      
      // 9. Update contacts
      let updatedContacts = [...contacts];
      const existingContact = contacts.find(c => c.address.toLowerCase() === recipientAddr.toLowerCase());
      
      if (existingContact) {
        updatedContacts = contacts.map(c => 
          c.address.toLowerCase() === recipientAddr.toLowerCase() 
            ? { ...c, last_interaction: Date.now() }
            : c
        );
      } else {
        updatedContacts.push({
          address: recipientAddr,
          user_id: '',
          last_interaction: Date.now()
        });
      }
      
      setContacts(updatedContacts);
      localStorage.setItem('secureChat_contacts', JSON.stringify(updatedContacts));
      
      // Clear message input
      setNewMessage('');
      
      toast({
        title: "Message Sent",
        description: "Your message has been encrypted and sent",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      console.error("Error sending message:", err);
      toast({
        title: "Failed to Send",
        description: "Error sending message",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Decrypt a message
  const decryptMessage = async (message: Message) => {
    try {
      // 1. Fetch encrypted data from IPFS using CID
      const encryptedData = await IPFSService.getJSON(message.cid);
      
      // 2. Derive key from keyId
      const key = await PBKDF2.deriveKey(encryptedData.key_id, 'SecureChatSystem');
      
      // 3. Convert arrays back to Uint8Arrays
      const iv = new Uint8Array(encryptedData.iv);
      const ciphertext = new Uint8Array(encryptedData.ciphertext);
      
      // 4. Decrypt the message
      const decryptedText = await AESGCM.decrypt(key, iv, ciphertext);
      
      // Update message with decrypted content
      const updatedMessages = messages.map(m => 
        m.id === message.id ? { ...m, content: decryptedText } : m
      );
      
      setMessages(updatedMessages);
      localStorage.setItem('secureChat_messages', JSON.stringify(updatedMessages));
      
      return decryptedText;
    } catch (err) {
      console.error("Error decrypting message:", err);
      toast({
        title: "Decryption Failed",
        description: "Error decrypting message",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return null;
    }
  };

  // Add received message from IPFS CID
  const addReceivedMessage = async (cid: string) => {
    try {
      setIsLoading(true);
      
      // 1. Fetch encrypted data from IPFS
      const encryptedData = await IPFSService.getJSON(cid);
      
      // 2. Verify the message is for us
      if (encryptedData.recipient_address.toLowerCase() !== account?.toLowerCase()) {
        throw new Error("Message is not addressed to this account");
      }
      
      // 3. Derive key from keyId
      const key = await PBKDF2.deriveKey(encryptedData.key_id, 'SecureChatSystem');
      
      // 4. Convert arrays back to Uint8Arrays
      const iv = new Uint8Array(encryptedData.iv);
      const ciphertext = new Uint8Array(encryptedData.ciphertext);
      
      // 5. Decrypt the message
      const decryptedText = await AESGCM.decrypt(key, iv, ciphertext);
      
      // 6. Create message object
      const messageId = `${encryptedData.sender_address}-${account}-${encryptedData.timestamp}`;
      const newMsg: Message = {
        id: messageId,
        sender: encryptedData.sender_address,
        sender_id: encryptedData.sender_id || '',
        recipient: account!,
        timestamp: encryptedData.timestamp,
        cid,
        content: decryptedText,
        direction: 'received'
      };
      
      // 7. Update message history
      const updatedMessages = [...messages, newMsg];
      setMessages(updatedMessages);
      localStorage.setItem('secureChat_messages', JSON.stringify(updatedMessages));
      
      // 8. Update contacts
      let updatedContacts = [...contacts];
      const existingContact = contacts.find(c => 
        c.address.toLowerCase() === encryptedData.sender_address.toLowerCase()
      );
      
      if (existingContact) {
        updatedContacts = contacts.map(c => 
          c.address.toLowerCase() === encryptedData.sender_address.toLowerCase() 
            ? { 
                ...c, 
                last_interaction: encryptedData.timestamp,
                user_id: encryptedData.sender_id || c.user_id 
              }
            : c
        );
      } else {
        updatedContacts.push({
          address: encryptedData.sender_address,
          user_id: encryptedData.sender_id || '',
          last_interaction: encryptedData.timestamp
        });
      }
      
      setContacts(updatedContacts);
      localStorage.setItem('secureChat_contacts', JSON.stringify(updatedContacts));
      
      toast({
        title: "Message Received",
        description: `New message from ${encryptedData.sender_id || encryptedData.sender_address.substring(0, 6)}...`,
        status: "info",
        duration: 3000,
        isClosable: true,
      });
      
      return newMsg;
    } catch (err) {
      console.error("Error adding received message:", err);
      toast({
        title: "Error",
        description: "Failed to process received message",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Get conversation with a contact
  const getConversation = (contactAddress: string) => {
    return messages.filter(msg => 
      (msg.sender.toLowerCase() === contactAddress.toLowerCase() && 
       msg.recipient.toLowerCase() === account?.toLowerCase()) ||
      (msg.sender.toLowerCase() === account?.toLowerCase() && 
       msg.recipient.toLowerCase() === contactAddress.toLowerCase())
    ).sort((a, b) => a.timestamp - b.timestamp);
  };

  // Select a contact for conversation
  const handleSelectContact = (contact: Contact) => {
    setSelectedContact(contact);
    setRecipientAddress('');
    
    // Decrypt any messages that haven't been decrypted yet
    const conversation = getConversation(contact.address);
    conversation.forEach(msg => {
      if (!msg.content) {
        decryptMessage(msg);
      }
    });
  };

  // Format timestamp
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <ChakraProvider>
      <Box p={4}>
        <Heading mb={6} textAlign="center">Secure Chat</Heading>
        
        {!account ? (
          <VStack spacing={4} align="center">
            <Text>Please connect your wallet to continue</Text>
            <Button 
              colorScheme="blue" 
              onClick={connectWallet}
              isLoading={isLoading}
            >
              Connect Wallet
            </Button>
          </VStack>
        ) : !isInitialized ? (
          <VStack spacing={4} align="center">
            <Text>Set up your secure chat identity</Text>
            <Input
              placeholder="Your user ID (e.g., email or username)"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              maxW="md"
            />
            <Button 
              colorScheme="green" 
              onClick={initializeUser}
              isLoading={isLoading}
              isDisabled={!userId}
            >
              Initialize Account
            </Button>
          </VStack>
        ) : (
          <Tabs variant="soft-rounded" colorScheme="blue">
            <TabList>
              <Tab>Chat</Tab>
              <Tab>Contacts</Tab>
              <Tab>Manual Receive</Tab>
            </TabList>
            
            <TabPanels>
              {/* Chat Tab */}
              <TabPanel>
                <Flex h="75vh">
                  {/* Contacts Sidebar */}
                  <Box 
                    w="250px" 
                    borderRight="1px" 
                    borderColor="gray.200" 
                    pr={3} 
                    overflowY="auto"
                  >
                    <Heading size="md" mb={4}>Contacts</Heading>
                    <List spacing={2}>
                      {contacts.map((contact, idx) => (
                        <ListItem 
                          key={idx} 
                          p={2} 
                          bg={selectedContact?.address === contact.address ? "blue.50" : "transparent"}
                          borderRadius="md"
                          cursor="pointer"
                          _hover={{ bg: "gray.50" }}
                          onClick={() => handleSelectContact(contact)}
                        >
                          <Flex align="center">
                            <Avatar size="sm" name={contact.user_id || contact.address} mr={2} />
                            <Box>
                              <Text fontWeight="bold" noOfLines={1}>
                                {contact.user_id || `${contact.address.substring(0, 6)}...${contact.address.substring(38)}`}
                              </Text>
                              <Text fontSize="xs" color="gray.500">
                                {new Date(contact.last_interaction).toLocaleDateString()}
                              </Text>
                            </Box>
                          </Flex>
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                  
                  {/* Chat Area */}
                  <Box flex="1" pl={3}>
                    {selectedContact ? (
                      <>
                        {/* Contact Header */}
                        <Flex 
                          align="center" 
                          p={3} 
                          borderBottom="1px" 
                          borderColor="gray.200"
                        >
                          <Avatar size="sm" name={selectedContact.user_id || selectedContact.address} mr={2} />
                          <Box>
                            <Text fontWeight="bold">
                              {selectedContact.user_id || `${selectedContact.address.substring(0, 6)}...${selectedContact.address.substring(38)}`}
                            </Text>
                            <Text fontSize="xs">{selectedContact.address}</Text>
                          </Box>
                        </Flex>
                        
                        {/* Messages */}
                        <Box 
                          h="calc(100% - 130px)" 
                          overflowY="auto" 
                          py={4}
                          px={2}
                        >
                          {getConversation(selectedContact.address).map((msg, idx) => (
                            <Box 
                              key={idx}
                              mb={4}
                              display="flex"
                              justifyContent={msg.direction === 'sent' ? 'flex-end' : 'flex-start'}
                            >
                              <Box
                                maxW="70%"
                                p={3}
                                borderRadius="lg"
                                bg={msg.direction === 'sent' ? 'blue.500' : 'gray.100'}
                                color={msg.direction === 'sent' ? 'white' : 'black'}
                              >
                                <Text>{msg.content || '(Encrypted Message)'}</Text>
                                <Text fontSize="xs" textAlign="right" mt={1} opacity={0.8}>
                                  {formatTime(msg.timestamp)}
                                </Text>
                              </Box>
                            </Box>
                          ))}
                        </Box>
                        
                        {/* Message Input */}
                        <Flex mt={4}>
                          <Input
                            placeholder="Type your message..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            mr={2}
                          />
                          <Button 
                            colorScheme="blue" 
                            onClick={sendMessage}
                            isLoading={isLoading}
                          >
                            Send
                          </Button>
                        </Flex>
                      </>
                    ) : (
                      <VStack justify="center" h="100%" spacing={4}>
                        <Text color="gray.500">Select a contact or enter a new address below</Text>
                        <Input
                          placeholder="Enter recipient Ethereum address"
                          value={recipientAddress}
                          onChange={(e) => setRecipientAddress(e.target.value)}
                          maxW="md"
                        />
                        <Input
                          placeholder="Type your message..."
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          maxW="md"
                        />
                        <Button 
                          colorScheme="blue" 
                          onClick={sendMessage}
                          isLoading={isLoading}
                          isDisabled={!recipientAddress || !newMessage}
                        >
                          Send to New Contact
                        </Button>
                      </VStack>
                    )}
                  </Box>
                </Flex>
              </TabPanel>
              
              {/* Contacts Tab */}
              <TabPanel>
                <Heading size="md" mb={4}>Your Contacts</Heading>
                {contacts.length > 0 ? (
                  <List spacing={3}>
                    {contacts.map((contact, idx) => (
                      <ListItem key={idx} p={3} borderRadius="md" borderWidth="1px">
                        <Flex justify="space-between" align="center">
                          <Box>
                            <Text fontWeight="bold">{contact.user_id || 'Unnamed Contact'}</Text>
                            <Text fontSize="sm">{contact.address}</Text>
                            <Text fontSize="xs" color="gray.500">
                              Last interaction: {new Date(contact.last_interaction).toLocaleString()}
                            </Text>
                          </Box>
                          <Button 
                            size="sm" 
                            colorScheme="blue"
                            onClick={() => handleSelectContact(contact)}
                          >
                            Chat
                          </Button>
                        </Flex>
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Text color="gray.500">No contacts yet. Start a conversation to add contacts.</Text>
                )}
              </TabPanel>
              
              {/* Manual Receive Tab */}
              <TabPanel>
                <Heading size="md" mb={4}>Receive Message</Heading>
                <Text mb={4}>
                  If someone sent you a message, enter the IPFS CID to retrieve and decrypt it.
                </Text>
                
                <Flex direction="column" maxW="md">
                  <Input 
                    placeholder="Enter message CID" 
                    mb={4}
                    id="message-cid-input"
                  />
                  <Button 
                    colorScheme="blue"
                    isLoading={isLoading}
                    onClick={() => {
                      const input = document.getElementById('message-cid-input') as HTMLInputElement;
                      if (input.value) {
                        addReceivedMessage(input.value);
                      } else {
                        toast({
                          title: "Missing CID",
                          description: "Please enter a valid CID",
                          status: "warning",
                          duration: 3000,
                          isClosable: true,
                        });
                      }
                    }}
                  >
                    Retrieve Message
                  </Button>
                </Flex>
              </TabPanel>
            </TabPanels>
          </Tabs>
        )}
      </Box>
    </ChakraProvider>
  );
}

export default App;