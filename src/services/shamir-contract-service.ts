/**
 * Service for interacting with the Shamir Secret Sharing Solidity contract
 * This replaces the client-side implementation with on-chain computation
 */
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, GAS_SETTINGS } from '../constants/contracts';

// Import contract ABIs
// Note: These would be generated when compiling the Solidity contracts
const ShamirFactoryABI = [
  "function createShamirContract() external returns (address)",
  "function getUserContract() external view returns (address)",
  "function hasContract(address user) external view returns (bool)",
  "event ContractCreated(address indexed user, address contractAddress)"
];

const ShamirSharingABI = [
  "function splitSecret(bytes calldata secret, uint256 numShares, uint256 threshold) external returns (uint256[] memory)",
  "function reconstructSecret(uint256[] calldata shareIndices) external view returns (bytes memory)",
  "function getShare(uint256 index) external view returns (uint256 x, uint256 y)",
  "function getShareConfig() external view returns (uint256 totalShares, uint256 threshold)",
  "event SharesGenerated(address indexed user, uint256 totalShares, uint256 threshold)",
  "event SecretReconstructed(address indexed user)"
];

// Factory contract address from constants
const FACTORY_CONTRACT_ADDRESS = CONTRACT_ADDRESSES.SHAMIR_FACTORY;

export interface Secretshare {
  x: number;  // Share index
  y: string;  // Share value (as string to handle large integers)
}

export const ShamirContractService = {
  /**
   * Initialize the factory contract
   * @param provider Ethers provider
   * @returns Factory contract instance
   */
  getFactoryContract: (provider: ethers.providers.Web3Provider): ethers.Contract => {
    return new ethers.Contract(
      FACTORY_CONTRACT_ADDRESS,
      ShamirFactoryABI,
      provider.getSigner()
    );
  },

  /**
   * Get or create a Shamir contract for the current user
   * @param provider Ethers provider
   * @returns Shamir contract instance
   */
  getUserShamirContract: async (provider: ethers.providers.Web3Provider): Promise<ethers.Contract> => {
    try {
      const factory = ShamirContractService.getFactoryContract(provider);
      
      // Check if user already has a contract
      let contractAddress = await factory.getUserContract();
      
      // If no contract exists, create one
      if (contractAddress === ethers.constants.AddressZero) {
        const tx = await factory.createShamirContract();
        const receipt = await tx.wait();
        
        // Extract contract address from event
        const event = receipt.events?.find((e: any) => e.event === 'ContractCreated');
        if (!event) {
          throw new Error('Failed to create Shamir contract: Event not found');
        }
        
        contractAddress = event.args?.contractAddress;
        if (!contractAddress) {
          throw new Error('Failed to extract contract address from event');
        }
      }
      
      // Return contract instance
      return new ethers.Contract(
        contractAddress,
        ShamirSharingABI,
        provider.getSigner()
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error in getUserShamirContract:", errorMessage);
      throw new Error(`Failed to access Shamir contract: ${errorMessage}`);
    }
  },

  /**
   * Split a secret using the contract
   * @param provider Ethers provider
   * @param secretBytes Secret as Uint8Array
   * @param numShares Number of shares to generate
   * @param threshold Minimum shares needed for reconstruction
   * @returns Array of shares
   */
  splitSecret: async (
    provider: ethers.providers.Web3Provider,
    secretBytes: Uint8Array,
    numShares: number,
    threshold: number
  ): Promise<Secretshare[]> => {
    try {
      const contract = await ShamirContractService.getUserShamirContract(provider);
      
      // Convert Uint8Array to hex string for contract call
      const secretHex = ethers.utils.hexlify(secretBytes);
      
      // Call contract to split secret with gas parameters
      const tx = await contract.splitSecret(secretHex, numShares, threshold, {
        gasLimit: 3000000  // Explicitly set gas limit
      });
      const receipt = await tx.wait();
      
      // Extract xCoordinates from transaction result
      let xCoordinates;
      
      // Try to get xCoordinates from event
      try {
        const event = receipt.events?.find((e: any) => e.event === 'SharesGenerated');
        if (event && event.args) {
          // Check if xCoordinates is directly in args
          if (event.args.xCoordinates) {
            xCoordinates = event.args.xCoordinates;
          } 
          // Otherwise check for other properties or indexed array access
          else if (event.args[3]) { // It might be the 4th argument in the event
            xCoordinates = event.args[3];
          }
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn("Could not extract xCoordinates from event:", errorMessage);
      }
      
      // Fallback to default indices if we couldn't get xCoordinates from event
      if (!xCoordinates) {
        xCoordinates = Array.from({ length: numShares }, (_, i) => i + 1);
      }
      
      // Get individual shares
      const shares: Secretshare[] = [];
      for (let i = 0; i < numShares; i++) {
        try {
          const shareIndex = typeof xCoordinates[i] === 'number' 
                            ? xCoordinates[i] 
                            : xCoordinates[i]?.toNumber?.() || (i + 1);
                            
          const shareResult = await contract.getShare(shareIndex);
          
          // Handle both array returns and named returns
          let x, y;
          if (Array.isArray(shareResult) || (shareResult && shareResult[0] !== undefined)) {
            [x, y] = shareResult;
          } else {
            x = shareResult.x;
            y = shareResult.y;
          }
          
          shares.push({
            x: typeof x === 'number' ? x : x.toNumber(),
            y: y.toString()
          });
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`Error getting share at index ${i}:`, errorMessage);
        }
      }
      
      return shares;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error in splitSecret:", errorMessage);
      throw new Error(`Failed to split secret on blockchain: ${errorMessage}`);
    }
  },

  /**
   * Reconstruct a secret from shares
   * @param provider Ethers provider
   * @param shares Array of shares
   * @param secretLength Expected length of the secret in bytes
   * @returns Reconstructed secret as Uint8Array
   */
  reconstructSecret: async (
    provider: ethers.providers.Web3Provider,
    shares: Secretshare[],
    secretLength: number
  ): Promise<Uint8Array> => {
    try {
      const contract = await ShamirContractService.getUserShamirContract(provider);
      
      // Extract share indices and ensure they are numbers
      const shareIndices = shares.map(share => 
        typeof share.x === 'string' ? parseInt(share.x, 10) : share.x
      );
      
      // Call contract to reconstruct secret with gas parameters
      const result = await contract.reconstructSecret(shareIndices, {
        gasLimit: 3000000  // Explicitly set gas limit for this complex operation
      });
      
      // If result is directly bytes, use it
      if (typeof result === 'string' && result.startsWith('0x')) {
        return ethers.utils.arrayify(result);
      }
      
      // If result has a specific field that contains bytes, use that
      if (result && result.bytes) {
        return ethers.utils.arrayify(result.bytes);
      }
      
      // Otherwise, assume result itself can be converted to bytes
      return ethers.utils.arrayify(result);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error in reconstructSecret:", errorMessage);
      throw new Error(`Failed to reconstruct secret on blockchain: ${errorMessage}`);
    }
  },

  /**
   * Get share configuration
   * @param provider Ethers provider
   * @returns Total shares and threshold
   */
  getShareConfig: async (
    provider: ethers.providers.Web3Provider
  ): Promise<{ totalShares: number, threshold: number }> => {
    const contract = await ShamirContractService.getUserShamirContract(provider);
    
    try {
      const result = await contract.getShareConfig();
      
      // Ethers v5 returns an array-like object for multiple returns
      // We can either use result[0] and result[1] or destructure with names
      const totalShares = result.totalShares || result[0];
      const threshold = result.threshold || result[1];
      
      return {
        totalShares: totalShares ? totalShares.toNumber() : 0,
        threshold: threshold ? threshold.toNumber() : 0
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error fetching share configuration:", errorMessage);
      return {
        totalShares: 0,
        threshold: 0
      };
    }
  }
};