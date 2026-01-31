import Navbar from "./components/Navbar";
import ItemGroup from "./components/ItemGroup";
import Items from "./components/Items";
import Cart from "./components/Cart";
import { AuthProvider } from "./components/Auth/AuthProvider";
import POSProvider from "./components/Opening/POSProvider";
import { useState } from "react";

function App() {
  const [activeItemGroup, setActiveItemGroup] = useState("")
  const [invoiceDetails, setInvoiceDetails] = useState({"customer": "", "items": [], "payments": []})

  return (
    <AuthProvider>
      <POSProvider>
        <Navbar/>
        <div className="container-fluid" style={{ position: "relative" }}>
          <div className="d-flex flex-wrap">
            <ItemGroup selectedGroup={activeItemGroup} onChangeGroup={(group) => setActiveItemGroup(group)} />
            <Items selectedGroup={activeItemGroup} invoiceDetails={invoiceDetails} onChangeInvoice={setInvoiceDetails}/>
            <Cart invoiceDetails={invoiceDetails} onChangeInvoice={setInvoiceDetails}/>
          </div>
        </div>
      </POSProvider>
    </AuthProvider>
  );
}

export default App;
