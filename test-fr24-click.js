const https = require('https');

function fetchFlightDetails(flightId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'data-live.flightradar24.com',
      path: `/click/wg/flights/data?flight=${flightId}`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.flightradar24.com/',
        'Origin': 'https://www.flightradar24.com',
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    
    req.on('error', reject);
    req.end();
  });
}

fetchFlightDetails('3fd78b7f').then(res => console.log(res.status, res.data.substring(0, 200))).catch(console.error);
