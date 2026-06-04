async function test() {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 5000); // 5s timeout

  try {
    console.log("Sending request to 127.0.0.1:9000...");
    const res = await fetch('http://127.0.0.1:9000/product/getsellerproduct', {
      headers: {
        'seller_id': '6a0c7bafa074bdcf09c67b12'
      },
      signal: controller.signal
    });
    clearTimeout(id);
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Data count:", data.count);
    console.log("Data:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error:", err.name === 'AbortError' ? 'Request timed out' : err.message);
  }
}

test();
