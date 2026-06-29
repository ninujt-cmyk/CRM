const email = "demowork0112000@gmail.com";
const password = "demo@123";

async function tryLogin(url) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    console.log(url, res.status);
  } catch (e) {
    console.log(url, "Error:", e.message);
  }
}

async function run() {
  await tryLogin("https://voice.unicornaisolution.com/api/login");
  await tryLogin("https://voice.unicornaisolution.com/api/v1/login");
}
run();
