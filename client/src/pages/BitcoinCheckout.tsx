import { trpc } from "@/lib/trpc";
import { CheckCircle2, Clipboard, Copy, LoaderCircle, RefreshCw, Wallet } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

async function copyText(value: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(successMessage);
  } catch {
    toast.error("Copy was unavailable. Select the value and copy it manually.");
  }
}

export default function BitcoinCheckout() {
  const { paymentToken = "" } = useParams<{ paymentToken: string }>();
  const payment = trpc.orders.paymentStatus.useQuery({ paymentToken }, { enabled: Boolean(paymentToken), refetchInterval: 15_000, staleTime: 0 });
  const [qrCode, setQrCode] = useState("");

  useEffect(() => {
    const bitcoinUri = payment.data?.bitcoinUri;
    if (!bitcoinUri) return;
    let active = true;
    QRCode.toDataURL(bitcoinUri, { width: 420, margin: 1, color: { dark: "#070708", light: "#f6f6f4" } })
      .then(url => { if (active) setQrCode(url); })
      .catch(() => { if (active) setQrCode(""); });
    return () => { active = false; };
  }, [payment.data?.bitcoinUri]);

  if (payment.isLoading) return <main className="bitcoin-page"><div className="bitcoin-loading"><LoaderCircle size={26} className="spin" /> Preparing your payment details…</div></main>;
  if (payment.isError || !payment.data) return <main className="bitcoin-page"><section className="bitcoin-error"><h1>Payment link unavailable</h1><p>Refresh this page or return to the price sheet and start checkout again.</p><Link className="sheet-checkout-button" href="/">Back to price sheet</Link></section></main>;

  const details = payment.data;
  const paymentReceived = details.paymentStatus === "received";
  const paymentConfirmed = details.paymentStatus === "confirmed";

  if (paymentConfirmed) return <main className="bitcoin-page"><section className="bitcoin-complete"><CheckCircle2 size={55} /><p className="eyebrow">STELLAR GEAR</p><h1>Order complete</h1><p>Thank you for ordering. Your Bitcoin payment has been confirmed and your order is now recorded.</p><div><span>Order number</span><strong>{details.orderNumber}</strong></div><div><span>Total paid</span><strong>{money(details.totalCents)}</strong></div><Link className="sheet-checkout-button" href="/">Back to price sheet</Link></section></main>;

  return <main className="bitcoin-page"><header className="bitcoin-header"><Link href="/">Stellar Gear</Link><span>Secure Bitcoin checkout</span></header><section className="bitcoin-card"><div className="bitcoin-status"><div className={`bitcoin-status-icon ${paymentReceived ? "is-received" : ""}`}>{paymentReceived ? <CheckCircle2 size={24} /> : <LoaderCircle size={24} className="spin" />}</div><div><p>{paymentReceived ? "Payment received" : "Waiting for Bitcoin"}</p><h1>{paymentReceived ? "Confirming payment" : "Send the exact amount"}</h1><span>{paymentReceived ? "Your payment was detected. This page will complete automatically after its first blockchain confirmation." : "Scan the QR code or copy the address. This page checks for payment every few seconds."}</span></div></div><div className="bitcoin-order-line"><span>Order {details.orderNumber}</span><strong>{money(details.totalCents)} total</strong></div><div className="bitcoin-payment-grid"><div className="bitcoin-qr">{qrCode ? <img src={qrCode} alt="Bitcoin payment QR code" /> : <Wallet size={40} />}</div><div className="bitcoin-details"><p>Send exactly</p><button className="bitcoin-amount" type="button" onClick={() => copyText(details.bitcoinAmountBtc, "Bitcoin amount copied")}>{details.bitcoinAmountBtc} BTC <Copy size={15} /></button><span className="bitcoin-rate-note">Bitcoin amount includes a unique payment reference for this order.</span><p>Send to this address</p><button className="bitcoin-address" type="button" onClick={() => copyText(details.bitcoinAddress, "Bitcoin address copied")}>{details.bitcoinAddress}<Clipboard size={16} /></button></div></div><div className="bitcoin-instructions"><span>1</span><p>Send <strong>{details.bitcoinAmountBtc} BTC</strong> to the displayed address.</p><span>2</span><p>Keep this page open while the payment is detected and confirmed.</p></div><button className="bitcoin-refresh" type="button" onClick={() => void payment.refetch()} disabled={payment.isFetching}><RefreshCw size={15} className={payment.isFetching ? "spin" : ""} /> {payment.isFetching ? "Checking payment…" : "Check payment now"}</button></section></main>;
}
