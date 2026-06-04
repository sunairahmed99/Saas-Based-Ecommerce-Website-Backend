async function test() {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 3000); // 3s timeout

  try {
    console.log("Sending request to 127.0.0.1:9000/product/latest...");
    const res = await fetch('http://127.0.0.1:9000/product/latest', {
      signal: controller.signal
    });
    clearTimeout(id);
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Data count:", data.data?.length || 0);
  } catch (err) {
    console.error("Error:", err.name === 'AbortError' ? 'Request timed out' : err.message);
  }
}

test();
