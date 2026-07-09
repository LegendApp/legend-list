import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";

function App() {
    return <RouterProvider router={router} />;
}

export default App;
