import { useContext } from "react";
import { logOutUser } from "../../api/User";
import { POSContext } from "../Opening/POSProvider";
import "./style.css";

const Navbar = () => {
  const { openingDetail } = useContext(POSContext);
  const handleLogout = () => {
    // TODO Need to add CSRf Token
    logOutUser().then((data) => {
      const redirectUrl = encodeURIComponent(window.location.pathname);
      window.location.href = `${window.location.origin}/login?redirect-to=${redirectUrl}`;
    });
  };
  return (
    <nav className="navbar navbar-expand-lg bg-body-tertiary sticky-top">
      <div className="container-fluid">
        <a
          className="navbar-brand text-center d-flex justify-content-around"
          href="#"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="35"
            height="40"
            fill="currentColor"
            className="bi bi-shop-window"
            viewBox="0 0 16 16"
          >
            <path d="M2.97 1.35A1 1 0 0 1 3.73 1h8.54a1 1 0 0 1 .76.35l2.609 3.044A1.5 1.5 0 0 1 16 5.37v.255a2.375 2.375 0 0 1-4.25 1.458A2.37 2.37 0 0 1 9.875 8 2.37 2.37 0 0 1 8 7.083 2.37 2.37 0 0 1 6.125 8a2.37 2.37 0 0 1-1.875-.917A2.375 2.375 0 0 1 0 5.625V5.37a1.5 1.5 0 0 1 .361-.976zm1.78 4.275a1.375 1.375 0 0 0 2.75 0 .5.5 0 0 1 1 0 1.375 1.375 0 0 0 2.75 0 .5.5 0 0 1 1 0 1.375 1.375 0 1 0 2.75 0V5.37a.5.5 0 0 0-.12-.325L12.27 2H3.73L1.12 5.045A.5.5 0 0 0 1 5.37v.255a1.375 1.375 0 0 0 2.75 0 .5.5 0 0 1 1 0M1.5 8.5A.5.5 0 0 1 2 9v6h12V9a.5.5 0 0 1 1 0v6h.5a.5.5 0 0 1 0 1H.5a.5.5 0 0 1 0-1H1V9a.5.5 0 0 1 .5-.5m2 .5a.5.5 0 0 1 .5.5V13h8V9.5a.5.5 0 0 1 1 0V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a.5.5 0 0 1 .5-.5" />
          </svg>
          <div className="d-flex flex-column mx-2">
            <h6 className="mb-0" style={{ color: "#FE9F43" }}>
              EASY
            </h6>
            <h6 className="my-0">POS</h6>
          </div>
        </a>

        <div className="d-flex justify-content-end gap-3 flex-shrink-1 navbar-other-items">
          <div className="input-group input-group-sm h-50 my-auto">
            <span className="input-group-text w-50">POS Profile</span>
            <input
              type="text"
              aria-label="First name"
              className="form-control w-30 outline-none"
              disabled={1}
              value={openingDetail?.pos_profile}
            />
          </div>

          <div className="input-group input-group-sm h-50 my-auto navbar-opening-item">
            <span className="input-group-text w-50">POS Opening Entry</span>
            <input
              type="text"
              aria-label="First name"
              className="form-control w-30"
              disabled={1}
              value={openingDetail?.name}
            />
          </div>

          <div
            className="input-group input-group-sm h-50 my-auto navbar-opening-item"
            style={{ width: "15rem" }}
          >
            <button type="button" className="btn btn-primary btn-sm">
              Close Shift
            </button>
          </div>

          <div
            className="input-group input-group-sm h-70 my-auto dropdown-center"
            style={{ width: "5rem" }}
          >
            <a
              className="btn border border-0"
              href="#"
              role="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="30"
                height="35"
                fill="currentColor"
                className="bi bi-person-circle"
                viewBox="0 0 16 16"
              >
                <path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0" />
                <path
                  fillRule="evenodd"
                  d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8m8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1"
                />
              </svg>
            </a>

            <ul className="dropdown-menu dropdown-menu-end">
              <li>
                <button className="dropdown-item" onClick={handleLogout}>
                  Log Out
                </button>
              </li>
              {/* <li>
                <a className="dropdown-item" href="#">
                  Another action
                </a>
              </li>
              <li>
                <a className="dropdown-item" href="#">
                  Something else here
                </a>
              </li> */}
            </ul>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
