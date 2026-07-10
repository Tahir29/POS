// app/api/auth/token/route.js
export async function POST(request) {
  const body = await request.text(); // form-urlencoded body

  const response = await fetch('https://lucira.uat.ornaverse.in/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await response.json();
  return Response.json(data, { status: response.status });
}