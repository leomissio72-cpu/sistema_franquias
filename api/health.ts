export default function handler(_req: any, res: any) {
  res.status(200).json({
    status: "ok",
    cloud: "connected",
    serverTime: new Date().toISOString(),
    connectedDevices: 0,
    dbVersion: 1,
  });
}
