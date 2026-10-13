import { Orb } from "../components/ui";
import { Link } from "../lib/router";

export default function NotFound({ inApp }: { inApp?: boolean }) {
  return (
    <div className="notfound">
      <Orb size="lg" />
      <h1>Page introuvable</h1>
      <p className="muted">Ce lien ne mène nulle part. Il a peut-être été déplacé.</p>
      <Link to={inApp ? "/app" : "/"} className="btn btn-primary">
        Retour à l'accueil
      </Link>
    </div>
  );
}
