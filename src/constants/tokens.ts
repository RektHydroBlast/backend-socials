/**
 * Token addresses for the NERO testnet
 * These addresses are used for testing and may change
 */

export const TESTNET_TOKEN_ADDRESSES = {
  // Stablecoins
  USDT: '0x1da998cfaa0c044d7205a17308b20c7de1bdcf74',
  DAI: '0x5d0e342ccd1ad86a16bfba26f404486940dbe345',
  USDC: '0xc86fed58edf0981e927160c50ecb8a8b05b32fed',
  
  // Test tokens
  EX_USDT: '0xb80c1825c11e9f90a78de064c5e584666909940c',
  SLICE: '0xf9e27108bd487864fe3a34e84177c885c18d6d48'
};

/**
 * Token metadata for commonly used tokens
 */
export const TOKEN_METADATA = {
  [TESTNET_TOKEN_ADDRESSES.USDT]: { symbol: 'USDT', decimals: 6, name: 'Tether USD' },
  [TESTNET_TOKEN_ADDRESSES.DAI]: { symbol: 'DAI', decimals: 18, name: 'Dai Stablecoin' },
  [TESTNET_TOKEN_ADDRESSES.USDC]: { symbol: 'USDC', decimals: 6, name: 'USD Coin' },
  [TESTNET_TOKEN_ADDRESSES.EX_USDT]: { symbol: 'exUSDT', decimals: 6, name: 'Example USDT' },
  [TESTNET_TOKEN_ADDRESSES.SLICE]: { symbol: 'SLICE', decimals: 18, name: 'SocialSlice' }
};

/**
 * Get tokens list in PaymasterToken format for components
 */
export const getTestnetTokensList = () => [
  { token: TESTNET_TOKEN_ADDRESSES.USDT, symbol: 'USDT', decimals: 6, price: '0' },
  { token: TESTNET_TOKEN_ADDRESSES.DAI, symbol: 'DAI', decimals: 18, price: '0' },
  { token: TESTNET_TOKEN_ADDRESSES.USDC, symbol: 'USDC', decimals: 6, price: '0' },
  { token: TESTNET_TOKEN_ADDRESSES.EX_USDT, symbol: 'exUSDT', decimals: 6, price: '0' },  { token: TESTNET_TOKEN_ADDRESSES.SLICE, symbol: 'SLICE', decimals: 18, price: '0' }
];

export const DEFAULT_TOKEN = TESTNET_TOKEN_ADDRESSES.USDC;
export const DEFAULT_TOKEN_SYMBOL = 'USDC';

/**
 * NERO Chain Information
 */
export const NERO_CHAIN_INFO = {
  name: "NERO Chain",
  description: "Fundamentally scalable, flexible, and with enhanced user experience in mind, NERO Chain is a Layer 1 modular blockchain fit for developers.",
  features: {
    accountAbstraction: true,
    gaslessTransactions: {
      subsidy: "0.1 NERO per account",
      dailyLimit: "10 transactions per day"
    },
    paymaster: {
      enabled: true,
      supportedTokens: ["USDT", "DAI", "USDC", "exUSDT", "SLICE"],
      description: "Pay gas fees with any available stablecoin"
    }
  }
};

/**
 * Oracle Provider Information
 */
export const ORACLE_PROVIDERS = {
  PERPLEXITY: {
    name: "Perplexity",
    description: "Primary oracle provider for event resolution",
    supported: true
  }
};
