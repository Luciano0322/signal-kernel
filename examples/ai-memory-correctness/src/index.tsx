import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Example root is missing from index.html");
}

createRoot(root).render(<App />);
