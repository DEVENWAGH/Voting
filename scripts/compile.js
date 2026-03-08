import solc from "solc";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the contract source code
const contractPath = path.resolve(__dirname, "../contracts/EnhancedVoting.sol");
const source = fs.readFileSync(contractPath, "utf8");

// Prepare the input for the compiler
const input = {
  language: "Solidity",
  sources: {
    "EnhancedVoting.sol": {
      content: source,
    },
  },
  settings: {
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode"],
      },
    },
    optimizer: {
      enabled: true,
      runs: 200,
    },
  },
};

// Compile the contract
console.log("Compiling EnhancedVoting.sol...");
const output = JSON.parse(solc.compile(JSON.stringify(input)));

// Check for errors
if (output.errors) {
  output.errors.forEach((error) => {
    console.error(error.formattedMessage);
  });

  const hasError = output.errors.some((error) => error.severity === "error");
  if (hasError) {
    process.exit(1);
  }
}

// Extract the contract
const contract = output.contracts["EnhancedVoting.sol"]["EnhancedVoting"];

// Create the output directory if it doesn't exist
const outputDir = path.resolve(__dirname, "../lib/contracts");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write the ABI and bytecode to a JSON file
const outputPath = path.resolve(outputDir, "EnhancedVoting.json");
const outputData = {
  abi: contract.abi,
  bytecode: contract.evm.bytecode.object,
};

fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));

console.log("✓ Contract compiled successfully!");
console.log(`✓ ABI and bytecode saved to ${outputPath}`);
