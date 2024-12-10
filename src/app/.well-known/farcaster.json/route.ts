export async function GET() {
    const appUrl = process.env.NEXT_PUBLIC_URL;
 
    
    const config = {
      accountAssociation: {
        header:
          "eyJmaWQiOjQyMDU2NCwidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweGREOGVFNTU1NTc0NGQ2ODQyZTNjNTcyZTQ2RjQyMDkyZWQ3MzI2YjYifQ",
        payload: "eyJkb21haW4iOiJodHRwczovL3d3dy5taW5pLWQzM20ueHl6LyJ9",
        signature:
          "MHhkMzdkZWM5NjY2MDhjZTQyNTRlNmJjODU2M2QzOGQzMDk4NDUzZWZjMzYyNDcxYWIyZDE3ZGZjYzIyNjcyZmI4NWM2MjQwZDBlZTc4YzljNzE1MjcxNTNkYTQyNTdjMjBkNTU4YzE5OTI0NGIyMzA2NjliYjdlY2EyNzY2NzRlNzFj",
      },
      frame: {
        version: "0.0.1",
        name: "d33m",
        iconUrl: `${appUrl}/512.png`,
        splashImageUrl: `${appUrl}/defifa_spinner.gif`,
        splashBackgroundColor: "#BD195D",
        homeUrl: appUrl,
        webhookUrl: `${appUrl}/api/webhook`,
      },
    };
  
    return Response.json(config);
  }