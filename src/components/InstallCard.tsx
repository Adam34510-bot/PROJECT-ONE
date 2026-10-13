import { Download, Share, SquarePlus, MoreVertical, CheckCircle2, Smartphone } from "lucide-react";
import { Notice, toast } from "./ui";
import { isIosSafari, useInstall } from "../lib/install";

/** Carte « Installer l'application » : vrai bouton quand le navigateur le permet, sinon la marche à suivre. */
export function InstallCard() {
  const { platform, installed, canPrompt, prompt } = useInstall();
  return (
    <section className="card card-pad">
      <div className="card-head">
        <span className="card-title">
          <Smartphone /> Application sur l'écran d'accueil
        </span>
      </div>
      {installed ? (
        <Notice tone="success" icon={<CheckCircle2 />}>
          L'application est installée sur cet appareil. Elle s'ouvre en plein écran et fonctionne hors ligne (sauf l'assistant IA).
        </Notice>
      ) : (
        <div className="stack gap-12">
          <p className="muted" style={{ fontSize: 14 }}>
            Installez PROJECT ONE comme une application, sans passer par l'App Store ni Google Play : icône sur l'écran d'accueil, plein écran, ouverture hors ligne.
          </p>
          {canPrompt && (
            <button
              className="btn btn-primary"
              style={{ alignSelf: "flex-start" }}
              onClick={async () => {
                if (await prompt()) toast.success("Installation lancée. L'icône apparaît sur votre écran d'accueil.");
              }}
            >
              <Download /> Installer l'application
            </button>
          )}
          {platform === "ios" && (
            <ol className="install-steps">
              {!isIosSafari() && <li>Ouvrez cette page dans <strong>Safari</strong>.</li>}
              <li>
                Touchez <Share size={15} /> <strong>Partager</strong> en bas de l'écran.
              </li>
              <li>
                Choisissez <SquarePlus size={15} /> <strong>Sur l'écran d'accueil</strong>, puis <strong>Ajouter</strong>.
              </li>
            </ol>
          )}
          {platform === "android" && !canPrompt && (
            <ol className="install-steps">
              <li>
                Dans Chrome, touchez <MoreVertical size={15} /> en haut à droite.
              </li>
              <li>
                Choisissez <strong>Installer l'application</strong> ou <strong>Ajouter à l'écran d'accueil</strong>.
              </li>
            </ol>
          )}
          {platform === "desktop" && !canPrompt && (
            <p className="faint" style={{ fontSize: 13 }}>
              Sur ordinateur, Chrome et Edge affichent une icône d'installation dans la barre d'adresse. Sur téléphone, ouvrez cette adresse pour l'installer.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
