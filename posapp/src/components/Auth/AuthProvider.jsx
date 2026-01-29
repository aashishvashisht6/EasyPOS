import { useEffect, useState } from "react";
import { AuthContext } from "./AuthContext";
import { fetchLoggedInUser } from "../../api/User";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkLogin();
  }, []);

  const checkLogin = async () => {
    fetchLoggedInUser().then((data) => {
      if (!data) {
        redirectToLogin();
        return;
      }
      const cookies = Object.fromEntries(
        document.cookie.split("; ").map((c) => c.split("=")),
      );
      setUser({ email: data, full_name: cookies?.full_name });
    });
    setLoading(false);
  };

  const redirectToLogin = () => {
    const redirectUrl = encodeURIComponent(window.location.pathname);
    window.location.href = `${window.location.origin}/login?redirect-to=${redirectUrl}`;
  };

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
