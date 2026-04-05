import axios from "axios";

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "/api",
  timeout: 15000,
});

export const createBatch = (data) => API.post("/batches", data);
export const getAllBatches = () => API.get("/batches");
export const getBatch = (id) => API.get(`/batches/${id}`);
export const updateShipment = (id, data) => API.put(`/batches/${id}/shipment`, data);
export const updateRetailPrice = (id, data) => API.put(`/batches/${id}/retail-price`, data);
export const confirmSale = (id, data) => API.put(`/batches/${id}/confirm-sale`, data);
export const getQRCode = (id) => API.get(`/batches/${id}/qr`);
export const getFraudAlerts = () => API.get("/batches/fraud/alerts");
export const getRealtimeOverview = (params) => API.get("/realtime/overview", { params });
export const getRealtimeForBatch = (id) => API.get(`/realtime/batch/${id}`);
export const getRealtimeTicker = () => API.get("/realtime/ticker");
export const getSystemMode = () => API.get("/system/mode");
export const getSystemMetrics = () => API.get("/system/metrics");

export default API;
