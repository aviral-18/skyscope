const { fetchFlight, fetchFromRadar } = require('flightradar24-client');

async function test() {
  try {
    const flights = await fetchFromRadar(50, 40, -10, 10);
    console.log(`Got ${flights.length} flights`);
    if (flights.length > 0) {
      console.log('Sample flight:', flights[0]);
      const details = await fetchFlight(flights[0].id);
      console.log('Details:', details);
    }
  } catch (err) {
    console.error(err);
  }
}
test();
