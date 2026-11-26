import { Download, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const APP_VERSION = '1.1.1';
const DOWNLOAD_PAGE_URL = 'https://smart-business-os.vercel.app/download';
const APK_URL = `https://smart-business-os.vercel.app/downloads/geethus-corner-${APP_VERSION}.apk`;

export default function DownloadApp() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6 sm:py-16">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl shadow-indigo-950/40 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="flex flex-col justify-center p-7 sm:p-11 lg:p-14">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500 shadow-lg shadow-indigo-500/20">
              <Smartphone size={24} aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold">Geethu&apos;s Corner</p>
              <p className="text-sm text-slate-400">Smart Business OS for Android</p>
            </div>
          </div>

          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-300">Version {APP_VERSION}</p>
          <h1 className="mt-3 max-w-xl text-3xl font-bold tracking-tight sm:text-5xl">Your shop, ready wherever you are.</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
            Install the signed Android app once. For future releases, tap Update on Home or the sign-in screen.
          </p>

          <a
            href={APK_URL}
            className="mt-8 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-indigo-500 px-6 py-3 text-base font-semibold text-white transition hover:bg-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 sm:w-fit"
          >
            <Download size={21} aria-hidden="true" />
            Download Android APK
          </a>

          <div className="mt-7 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 shrink-0 text-emerald-400" size={18} aria-hidden="true" />
              <span>Signed with the existing app identity</span>
            </div>
            <div className="flex items-start gap-2.5">
              <RefreshCw className="mt-0.5 shrink-0 text-indigo-300" size={18} aria-hidden="true" />
              <span>Installs over version 1.1.0</span>
            </div>
          </div>
        </section>

        <aside className="flex flex-col items-center justify-center border-t border-white/10 bg-white p-8 text-center text-slate-900 lg:border-l lg:border-t-0 lg:p-12">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <QRCodeSVG value={DOWNLOAD_PAGE_URL} size={210} level="M" includeMargin title="Open the Geethu's Corner app download page" />
          </div>
          <h2 className="mt-6 text-xl font-bold">Scan with your phone</h2>
          <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">Open your camera, scan the code, then tap the APK download button.</p>
          <div className="mt-6 w-full rounded-xl bg-slate-100 px-4 py-3 text-left text-xs leading-5 text-slate-600">
            Android may ask permission to install apps from your browser. Allow it for this installation, then follow the system prompt.
          </div>
        </aside>
      </div>
    </main>
  );
}
