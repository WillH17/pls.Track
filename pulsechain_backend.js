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
  console.log("🚀 Request received for wallet:", wallet);

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
        topic1: fromTopic,
        topic0_1_opr: 'and'
      }
    });


    console.log('Logs API response:', logsResponse.data); // <-- This logs the raw response for debugging

    const logs = logsResponse.data.result;

    if (!Array.isArray(logs)) {
      return res.status(404).json({
        error: "No token transfers found for this wallet",
        details: logsResponse.data.message || "No logs returned"
      });
    }

    const tokenContracts = [...new Set(logs.map(log => log.address.toLowerCase()))];

    console.log("Token contracts to process:", tokenContracts);

    const tokens = await Promise.all(tokenContracts.map(async (contract) => {
      try {
        const [infoResp, balanceResp, priceResp] = await Promise.all([
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
          }),
          axios.get(`https://api.dexscreener.com/latest/dex/tokens/${contract}`)
        ]);
    
        // Validate tokeninfo
        const info = infoResp.data.result;
        if (!info || !info.name || !info.symbol || !info.decimals) {
          console.warn(`Tokeninfo missing or invalid for ${contract}:`, info);
          return null;
        }
    
        // Balance parsing
        const rawBalance = balanceResp.data.result;
        const decimals = parseInt(info.decimals);
        const normalizedBalance = parseFloat(rawBalance) / Math.pow(10, decimals);
    
        // Price parsing
        let price = 0;
        const pairs = priceResp.data.pairs;
        if (Array.isArray(pairs) && pairs.length > 0 && pairs[0].priceUsd) {
          price = parseFloat(pairs[0].priceUsd);
        }
    
        const value = parseFloat((normalizedBalance * price).toFixed(4));
    
        return {
          name: info.name,
          symbol: info.symbol,
          address: contract,
          balance: parseFloat(normalizedBalance.toFixed(4)),
          price: price,
          value: value
        };
      } catch (err) {
        console.warn(`Failed to fetch data for ${contract}:`, err.message);
        return null;
      }
    }));


    res.json(tokens.filter(Boolean));

  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch portfolio', details: error.message });
  }
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
