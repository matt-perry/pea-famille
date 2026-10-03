"""
Cours quotidiens Yahoo Finance via la bibliothèque yfinance.

Yahoo refuse souvent les demandes venant des serveurs de GitHub (erreur 429) ;
yfinance se présente comme un navigateur et passe là où un simple appel échoue.

Usage : python3 robot/yahoo.py SYMBOLE DEBUT FIN   (dates AAAA-MM-JJ, FIN incluse)
Sortie : {"currency": "EUR", "bars": [["AAAA-MM-JJ", clôture, clôture ajustée ou null], ...]}
En cas d'échec : message sur la sortie d'erreur et code de sortie 1.
"""
import json
import math
import sys
from datetime import date, timedelta


def clean(value):
    """Cours positif arrondi à 4 décimales (retire le bruit des flottants), sinon None."""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number) or number <= 0:
        return None
    return round(number, 4)


def to_bars(frame):
    bars = []
    for stamp, row in frame.iterrows():
        close = clean(row.get("Close"))
        if close is None:
            continue
        # l'index est à l'heure de la place (Europe/Paris) : la date est celle de la séance
        bars.append([stamp.strftime("%Y-%m-%d"), close, clean(row.get("Adj Close"))])
    bars.sort(key=lambda bar: bar[0])
    return bars


def main():
    if len(sys.argv) != 4:
        raise SystemExit("usage : yahoo.py SYMBOLE DEBUT FIN")
    symbol, start, end = sys.argv[1:4]
    end_exclusive = (date.fromisoformat(end) + timedelta(days=1)).isoformat()
    date.fromisoformat(start)

    import yfinance as yf

    ticker = yf.Ticker(symbol)
    frame = ticker.history(
        start=start,
        end=end_exclusive,
        interval="1d",
        auto_adjust=False,
        actions=False,
        raise_errors=True,
    )
    currency = None
    try:
        currency = (ticker.history_metadata or {}).get("currency")
    except Exception:
        pass
    print(json.dumps({"currency": currency, "bars": to_bars(frame)}))


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as error:  # message court et lisible dans l'état du robot
        text = str(error).strip().splitlines()
        print(f"{type(error).__name__}: {text[0] if text else 'erreur inconnue'}", file=sys.stderr)
        sys.exit(1)
