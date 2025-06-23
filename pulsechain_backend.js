// Backend: Node.js + Express
// Purpose: Return all PRC-20 tokens for a given PulseChain wallet
// Uses BlockScout API to scan transfer logs and fetch token balances

const express = require('express');
const axios = require('axios');
const app = express();
const PORT = 3000;

// Helper to pad address for topics
const padAddress = (addr) => '0x' + addr.toLowerCase().replace('0x', '').padStart(64, '0');

app.get('/portfolio/:wallet', async (req, res) => {
  const wallet = req.params.wallet.toLowerCase();
  const apiBase = 'https://api.scan.pulsechain.com/api';

  try {
    // Step 1: Fetch Transfer logs
    const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    const fromTopic = padAddress(wallet);

    const logsResponse = await axios.get(apiBase, {
      params: {
        module: 'logs',
        action: 'getLogs',
        fromBlock: '0',
        toBlock: 'latest',
        topic0: transferTopic,
        topic1: fromTopic
      }
    });

    const logs = logsResponse.data.result;
    

    if (!Array.isArray(logs)) {
      return res.status(500).json({
        error: "Failed to fetch portfolio",
        details: "Transfer logs are missing or malformed",
      });
    }

    const tokenContracts = [...new Set(logs.map(log => log.address.toLowerCase()))];


    const tokens = await Promise.all(tokenContracts.map(async (contract) => {
      try {
        const [infoResp, balanceResp] = await Promise.all([
          axios.get(apiBase, {
            params: {
              module: 'token',
              action: 'tokeninfo',
              contractaddress: contract
            }
          }),
          axios.get(apiBase, {
            params: {
              module: 'account',
              action: 'tokenbalance',
              contractaddress: contract,
              address: wallet
            }
          })
        ]);

        const info = infoResp.data.result;
        const balance = balanceResp.data.result;
        return {
          name: info.name,
          symbol: info.symbol,
          decimals: parseInt(info.decimals),
          balance: (parseFloat(balance) / Math.pow(10, parseInt(info.decimals))).toFixed(4),
          contract: contract
        };
      } catch (err) {
        return null;
      }
    }));

    res.json(tokens.filter(Boolean));

  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch portfolio', details: error.message });
  }
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
