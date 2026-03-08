# Aadhaar Voting System - Setup Guide

Complete guide to set up and run the Aadhaar Voting System locally.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn** (v1.22+)
- **Git** - [Download here](https://git-scm.com/)
- **MetaMask** browser extension - [Install here](https://metamask.io/)

### Verify Installation

```bash
node --version  # Should be v18 or higher
npm --version   # Should be 8 or higher
```

## Installation Steps

### 1. Clone the Repository

```bash
git clone <repository-url>
cd VotingDApp
```

### 2. Install Dependencies

Using npm:

```bash
npm install
```

Using yarn:

```bash
yarn install
```

This will install all required dependencies including:

- Hardhat (Ethereum development environment)
- Ethers.js (Ethereum library)
- React & Vite (Frontend framework)
- Testing libraries (Mocha, Chai)

### 3. Environment Configuration

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit the `.env` file with your configuration (see `.env.example` for all options).

**Minimum required for local development:**

```env
# No configuration needed for local Hardhat network
```

**For testnet deployment:**

```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
MUMBAI_RPC_URL=https://polygon-mumbai.g.alchemy.com/v2/YOUR_API_KEY
PRIVATE_KEY=your_private_key_here
```

⚠️ **Security Warning**: Never commit your `.env` file or share your private keys!

## Running Tests

### Run All Tests

```bash
npm test
```

This will run:

- Smart contract tests (EnhancedVoting.test.js)
- Wallet service tests (walletService.test.js)
- Encryption utility tests (encryptionUtils.test.js)

### Run Specific Test Files

```bash
npm test -- test/EnhancedVoting.test.js
npm test -- test/walletService.test.js
```

### Test Coverage

The test suite covers:

- ✅ Election creation and management
- ✅ Candidate registration
- ✅ Voter registration with Aadhaar
- ✅ Vote casting with anonymity
- ✅ Result calculation
- ✅ Access control and permissions

## Compiling Contracts

### Compile Smart Contracts

```bash
npm run compile
```

This will:

- Compile the `EnhancedVoting.sol` contract
- Generate ABI and bytecode
- Save artifacts to `src/contracts/Voting.json`

### Verify Compilation

After compilation, check that `src/contracts/Voting.json` exists and contains:

- Contract ABI
- Bytecode
- Contract metadata

## Deploying Contracts

### 1. Deploy to Local Hardhat Network

Start a local Hardhat node in one terminal:

```bash
npx hardhat node
```

This will:

- Start a local Ethereum network on `http://127.0.0.1:8545`
- Create 20 test accounts with 10,000 ETH each
- Display account addresses and private keys

In another terminal, deploy the contract:

```bash
npm run deploy:local
```

The script will:

- Deploy the EnhancedVoting contract
- Display the contract address
- Save the address to `src/contracts/contract-address.json`

### 2. Deploy to Sepolia Testnet

First, get test ETH from a faucet:

- [Sepolia Faucet 1](https://sepoliafaucet.com/)
- [Sepolia Faucet 2](https://www.alchemy.com/faucets/ethereum-sepolia)

Configure your `.env` file with Sepolia RPC URL and private key, then:

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

### 3. Deploy to Mumbai Testnet (Polygon)

Get test MATIC from:

- [Mumbai Faucet](https://faucet.polygon.technology/)

Configure your `.env` file with Mumbai RPC URL and private key, then:

```bash
npx hardhat run scripts/deploy.js --network mumbai
```

### 4. Verify Deployment

After deployment, you should see:

```
Deploying EnhancedVoting contract...
EnhancedVoting deployed to: 0x...
Election Commission address: 0x...
Contract address saved to src/contracts/contract-address.json
```

## Running the Frontend

### 1. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### 2. Configure MetaMask

**For Local Hardhat Network:**

1. Open MetaMask
2. Click network dropdown → Add Network → Add Network Manually
3. Enter:
   - Network Name: `Hardhat Local`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency Symbol: `ETH`
4. Import a test account using one of the private keys from `npx hardhat node`

**For Sepolia Testnet:**

1. MetaMask → Networks → Add Network
2. Select "Sepolia" from the list
3. Ensure you have test ETH in your account

**For Mumbai Testnet:**

1. MetaMask → Networks → Add Network Manually
2. Enter:
   - Network Name: `Mumbai Testnet`
   - RPC URL: `https://rpc-mumbai.maticvigil.com/`
   - Chain ID: `80001`
   - Currency Symbol: `MATIC`

### 3. Connect Wallet

1. Open the application in your browser
2. Click "Connect Wallet"
3. Approve the connection in MetaMask
4. You should see your wallet address displayed

### 4. Update Contract Address

If you deployed to a different network, update the contract address in:

- `src/contracts/contract-address.json`

Or the application will automatically read from this file.

## Building for Production

### Create Production Build

```bash
npm run build
```

This will:

- Create an optimized production build
- Output files to the `dist/` directory
- Minify and bundle all assets

### Preview Production Build

```bash
npm run preview
```

### Deploy to Hosting

The `dist/` folder can be deployed to:

- **Vercel**: `vercel deploy`
- **Netlify**: Drag and drop `dist/` folder
- **GitHub Pages**: Push `dist/` to `gh-pages` branch
- **IPFS**: `ipfs add -r dist/`

## Troubleshooting

### Issue: "Cannot find module 'hardhat'"

**Solution**: Reinstall dependencies

```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: "Error: could not detect network"

**Solution**: Ensure Hardhat node is running

```bash
npx hardhat node
```

### Issue: "Nonce too high" error

**Solution**: Reset MetaMask account

1. MetaMask → Settings → Advanced
2. Click "Clear activity tab data"
3. Reconnect to the network

### Issue: "Insufficient funds" error

**Solution**:

- For local network: Import a test account from Hardhat node
- For testnet: Get test tokens from faucets

### Issue: Contract not found at address

**Solution**: Redeploy the contract and update the address

```bash
npm run deploy:local
# Update src/contracts/contract-address.json with new address
```

### Issue: "Transaction reverted" errors

**Solution**: Check that:

1. You're connected to the correct network
2. Contract is deployed on that network
3. You have sufficient gas
4. You're using the correct contract address

### Issue: Frontend not connecting to contract

**Solution**:

1. Verify contract address in `contract-address.json`
2. Check that ABI is up to date in `src/contracts/Voting.json`
3. Recompile contracts: `npm run compile`
4. Restart development server

### Issue: Tests failing

**Solution**:

1. Ensure all dependencies are installed
2. Check Node.js version (should be v18+)
3. Clear Hardhat cache: `npx hardhat clean`
4. Recompile: `npm run compile`
5. Run tests again: `npm test`

## Project Structure

```
VotingDApp/
├── contracts/              # Smart contracts
│   └── EnhancedVoting.sol
├── scripts/               # Deployment scripts
│   ├── compile.js
│   ├── deploy.js
│   └── deploy-local.js
├── test/                  # Test files
│   ├── EnhancedVoting.test.js
│   ├── walletService.test.js
│   └── encryptionUtils.test.js
├── src/                   # Frontend source
│   ├── components/        # React components
│   ├── contracts/         # Contract ABIs
│   ├── services/          # Business logic
│   ├── utils/            # Utility functions
│   └── App.jsx           # Main app component
├── public/               # Static assets
├── hardhat.config.js     # Hardhat configuration
├── vite.config.js        # Vite configuration
├── package.json          # Dependencies
└── .env                  # Environment variables
```

## Next Steps

1. ✅ Complete setup and installation
2. ✅ Run tests to verify everything works
3. ✅ Deploy contract to local network
4. ✅ Start frontend and connect wallet
5. 📖 Read [DEPLOYMENT.md](./DEPLOYMENT.md) for testnet/mainnet deployment
6. 🔧 Start developing or customizing the application

## Additional Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [Ethers.js Documentation](https://docs.ethers.org/)
- [React Documentation](https://react.dev/)
- [Solidity Documentation](https://docs.soliditylang.org/)
- [MetaMask Documentation](https://docs.metamask.io/)

## Support

If you encounter issues not covered in this guide:

1. Check the [GitHub Issues](https://github.com/your-repo/issues)
2. Review the [DEPLOYMENT.md](./DEPLOYMENT.md) guide
3. Consult the troubleshooting section above

## Security Notes

⚠️ **Important Security Reminders**:

- Never commit `.env` files to version control
- Never share private keys or seed phrases
- Use test networks for development
- Audit smart contracts before mainnet deployment
- Keep dependencies updated for security patches
