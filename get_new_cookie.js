async function run() {
  const res = await fetch("https://voice.unicornaisolution.com/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "email=demowork0112000%40gmail.com&password=demo%40123",
    redirect: "manual"
  });
  console.log("Status:", res.status);
  console.log("Headers:", Object.fromEntries(res.headers.entries()));
}
run();
