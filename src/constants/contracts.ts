/**
 * Contract addresses and configuration
 */

// Contract addresses - replace with your deployed contract addresses
export const CONTRACT_ADDRESSES = {
    // Original contracts
    ECC_OPERATIONS: '0x2F21Db7415cD94A3065ACCb00AE6e1AF3752c838',
    KEY_SHARE_REGISTRY: '0x4E1A1F818ca4113B26482dEd4290Da65aAf61CFb',
    
    // New Shamir Secret Sharing contracts
    SHAMIR_FACTORY: '0xE12715cDE854111e2B688948B5121450651cE293',
  };
  
  // Contract network (for reference)
  export const CONTRACT_NETWORK = 'Bitkub Chain Testnet';
  
  // Gas settings for contract transactions
  export const GAS_SETTINGS = {
    gasLimit: 3000000,
    maxFeePerGas: 250000000000, // 250 gwei
    maxPriorityFeePerGas: 2000000000 // 2 gwei
  };