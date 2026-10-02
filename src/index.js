export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ status: "ok", service: "octee-airlines" });
    }

    return Response.json({
      name: "Octee Airlines",
      status: "starting",
      health: "/health",
    });
  },
};
