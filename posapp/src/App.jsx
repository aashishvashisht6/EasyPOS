import Navbar from './components/Navbar';
import ItemGroup from './components/ItemGroup';
import Items from './components/Items';
import Cart from './components/Cart'

function App() {

  return (
    <>
      <Navbar/>
      <div className="container-fluid" style={{ position: "relative" }}>
        <div className="d-flex flex-wrap">
          <ItemGroup />
          <Items />
          <Cart />
        </div>
      </div>
    </>
  )
}

export default App
