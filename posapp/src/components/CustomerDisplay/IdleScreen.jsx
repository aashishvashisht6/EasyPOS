
import { useTranslation } from "../../translation";
const IdleScreen = () => {
  const { __ } = useTranslation();
  return (
    <div className="customer-display-screen customer-display-idle">
      <i className="bi bi-shop" style={{ fontSize: 72, color: "var(--color-primary)" }} />
      <h1 className="mt-4">{__("Welcome")}</h1>
      <p className="text-muted">{__("Your order will appear here shortly.")}</p>
    </div>
  );
};

export default IdleScreen;
