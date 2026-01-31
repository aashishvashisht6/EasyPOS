import { createContext, useEffect, useState, useContext } from "react";
import OpeningEntryModal from "./OpeningEntryModal";
import { AuthContext } from "../Auth/AuthContext";
import { fetchOpeningEntry } from "../../api/OpeningEntry";

export const POSContext = createContext();

const POSProvider = ({ children }) => {
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [hasOpeningEntry, setHasOpeningEntry] = useState(false);
  const [openingDetail, setOpeningDetail] = useState({});

  const checkOpeningEntry = async () => {
    fetchOpeningEntry(user.email).then((data) => {
      if (data && data.pos_profile) {
        setHasOpeningEntry(true);
        setOpeningDetail(data)
      } else {
        setHasOpeningEntry(false);
      }
      setLoading(false);
    });
  };

  const setOpeningEntry = (opening_details) => {
    console.log(opening_details, "opening_details")
    if(opening_details?.name){
        setHasOpeningEntry(true)
        setOpeningDetail(opening_details)
    }
  }

  useEffect(() => {
    if (!user?.email) return;
    checkOpeningEntry();
  }, [user]);

  if (loading)
    return (
      <div className="d-flex justify-content-center align-items-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );

  if (!hasOpeningEntry) {
    return <OpeningEntryModal onSuccess={setOpeningEntry} />;
  }

  return (
    <POSContext.Provider value={{ hasOpeningEntry, openingDetail }}>
      {children}
    </POSContext.Provider>
  );
};

export default POSProvider;
