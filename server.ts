import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, "data.json");

// Initial data structure
const initialData = {
  orders: [],
  inventory: [
    { id: "1", name: "Farina 00", quantity: 50, unit: "kg", minThreshold: 10 },
    { id: "2", name: "Pomodori", quantity: 20, unit: "kg", minThreshold: 5 },
    { id: "3", name: "Mozzarella", quantity: 15, unit: "kg", minThreshold: 5 },
    { id: "4", name: "Birra alla spina", quantity: 100, unit: "L", minThreshold: 20 },
  ],
  menu: [
    { id: "m1", name: "Margherita", price: 7.5, category: "Pizze", ingredients: ["1", "2", "3"] },
    { id: "m2", name: "Diavola", price: 9.0, category: "Pizze", ingredients: ["1", "2", "3"] },
    { id: "m3", name: "Birra Media", price: 5.0, category: "Bevande", ingredients: ["4"] },
    { id: "m4", name: "Acqua Naturale", price: 2.0, category: "Bevande", ingredients: [] },
  ],
  staff: [
    { id: "s1", name: "Marco", role: "admin", pin: "1234" },
    { id: "s2", name: "Giulia", role: "waiter", pin: "2222" },
    { id: "s3", name: "Luca", role: "chef", pin: "3333" },
  ],
  tables: Array.from({ length: 12 }, (_, i) => ({
    id: `t${i + 1}`,
    number: (i + 1).toString(),
    status: "free"
  }))
};

// Load or initialize data
let dbData = initialData;
if (fs.existsSync(DATA_FILE)) {
  try {
    const savedData = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    // Merge staff to ensure PINs exist if they were missing in old data
    if (savedData.staff) {
      savedData.staff = savedData.staff.map((s: any) => {
        const initialStaff = initialData.staff.find(is => is.id === s.id);
        return { ...s, pin: s.pin || initialStaff?.pin || "1234" };
      });
    }
    dbData = { ...initialData, ...savedData };
  } catch (e) {
    console.error("Error loading data, using defaults");
  }
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(dbData, null, 2));
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  app.use(express.json());

  // API Routes
  app.get("/api/data", (req, res) => {
    res.json(dbData);
  });

  app.post("/api/orders", (req, res) => {
    const newOrder = {
      ...req.body,
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      status: "pending"
    };
    dbData.orders.push(newOrder);
    
    // Update table status
    const table = dbData.tables.find(t => t.number === newOrder.table);
    if (table) {
      table.status = "occupied";
    }

    // Update inventory (simple logic)
    newOrder.items.forEach((item: any) => {
      const menuItem = dbData.menu.find(m => m.id === item.id);
      if (menuItem) {
        menuItem.ingredients.forEach(ingId => {
          const ingredient = dbData.inventory.find(i => i.id === ingId);
          if (ingredient) {
            ingredient.quantity -= 0.1 * item.quantity; // Mock consumption
          }
        });
      }
    });

    saveData();
    io.emit("order:new", newOrder);
    io.emit("inventory:update", dbData.inventory);
    res.status(201).json(newOrder);
  });

  app.patch("/api/orders/:id", (req, res) => {
    const { id } = req.params;
    const orderIndex = dbData.orders.findIndex(o => o.id === id);
    if (orderIndex !== -1) {
      dbData.orders[orderIndex] = { ...dbData.orders[orderIndex], ...req.body };
      saveData();
      io.emit("order:update", dbData.orders[orderIndex]);
      res.json(dbData.orders[orderIndex]);
    } else {
      res.status(404).json({ error: "Order not found" });
    }
  });

  app.post("/api/tables/:id/pay", (req, res) => {
    const { id } = req.params;
    const table = dbData.tables.find(t => t.id === id);
    if (table) {
      const tableOrders = dbData.orders.filter(o => o.table === table.number && o.status !== 'paid');
      tableOrders.forEach(o => o.status = 'paid');
      table.status = 'free';
      saveData();
      io.emit("data:update", dbData);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Table not found" });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = 3000;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
