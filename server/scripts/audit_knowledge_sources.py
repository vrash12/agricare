"""Read-only reference availability audit. Never certifies or publishes advice."""
import argparse
import csv
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
import runpy
from urllib.request import Request, urlopen
from urllib.parse import urlparse


def check(url):
    try:
        with urlopen(Request(url, headers={'User-Agent': 'AgriCare-Reference-Audit/1.0'}), timeout=15) as response:
            snippet = response.read(8192).decode('utf-8', errors='ignore').lower()
            blocked = any(text in snippet for text in ('verify you are human', 'just a moment...', 'captcha'))
            destination = response.url
            official = any((urlparse(destination).hostname or '').lower().endswith(suffix)
                           for suffix in ('.gov.ph', '.edu.ph', '.fao.org', '.irri.org'))
            return ('needs_manual_check' if blocked or not official else 'reachable',
                    response.status, destination, '')
    except Exception as error:
        return ('needs_manual_check', '', url, str(error))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    articles = runpy.run_path(str(Path(__file__).with_name('seed_knowledge.py')))['ARTICLES']
    urls = sorted({article['sourceUrl'] for article in articles})
    with ThreadPoolExecutor(max_workers=6) as executor:
        checked = dict(zip(urls, executor.map(check, urls)))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat()
    with args.output.open('w', newline='', encoding='utf-8-sig') as file:
        writer = csv.DictWriter(file, fieldnames=['id', 'title', 'sourceName', 'sourceUrl', 'availability', 'httpStatus', 'finalUrl', 'error', 'checkedAt', 'contentValidation'])
        writer.writeheader()
        for article in articles:
            availability, status, destination, error = checked[article['sourceUrl']]
            writer.writerow({**{key: article[key] for key in ('id', 'title', 'sourceName', 'sourceUrl')},
                             'availability': availability, 'httpStatus': status, 'finalUrl': destination,
                             'error': error, 'checkedAt': now, 'contentValidation': 'Pending authorized LGU review'})
    print(f'{len(articles)} FAQs; {len(urls)} unique references; {sum(row[0] == "reachable" for row in checked.values())} reachable references.')
    print(f'Read-only report saved to {args.output}. Availability does not establish content accuracy.')


if __name__ == '__main__':
    main()
