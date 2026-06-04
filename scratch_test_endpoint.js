async function test() {
  try {
    const res = await fetch('http://localhost:9000/product/getsellerproduct', {
      headers: {
        'seller_id': '6a0c7bafa074bdcf09c67b12'
      }
    });
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Data:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

test();
