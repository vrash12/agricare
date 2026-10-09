"""Deterministic bilingual query matching; scores are relevance, not correctness."""
import re
import unicodedata

STOP_WORDS = set('a about ang and ano are at ba bakit can do for how i in is ito ko may mga me my na ng of on or our sa the this to what when where which who why with we you your does did there kung paano pwede maaari aking nang po ho naman lang please should would could need kailangan dapat help tulong maging gusto want ginagamit use using'.split())
TERMS = {
    'palay': 'rice', 'bigas': 'rice', 'mais': 'corn', 'maize': 'corn',
    'gulay': 'vegetable', 'gulayan': 'vegetable', 'vegetables': 'vegetable',
    'prutas': 'fruit', 'fruits': 'fruit', 'bukid': 'farm', 'sakahan': 'farm',
    'magsasaka': 'farmer', 'peste': 'pest', 'pests': 'pest', 'insekto': 'insect',
    'sakit': 'disease', 'karamdaman': 'disease', 'diseases': 'disease',
    'halaman': 'plant', 'plants': 'plant', 'tanim': 'plant',
    'pagtatanim': 'planting', 'magtanim': 'planting', 'itanim': 'planting',
    'barayti': 'variety', 'varieties': 'variety', 'punla': 'seedling',
    'seedlings': 'seedling', 'kuhol': 'snail', 'snails': 'snail',
    'patubig': 'irrigation', 'damo': 'weed', 'weeds': 'weed',
    'bodega': 'storage', 'gastos': 'cost', 'panahon': 'weather',
    'bagyo': 'typhoon', 'baha': 'flood', 'hayop': 'animal', 'animals': 'animal',
    'bakuna': 'vaccination', 'pakain': 'feed', 'dahon': 'leaf', 'leaves': 'leaf',
    'dilaw': 'yellow', 'naninilaw': 'yellow', 'yellowing': 'yellow',
    'lupa': 'soil', 'pataba': 'fertilizer', 'abono': 'fertilizer',
    'binhi': 'seed', 'buto': 'seed', 'seeds': 'seed', 'ulan': 'rain',
    'tubig': 'water', 'ani': 'harvest', 'anihin': 'harvest',
    'pagaani': 'harvest', 'pag-aani': 'harvest', 'harvesting': 'harvest',
    'presyo': 'price', 'benta': 'market', 'pamilihan': 'market',
    'rehistro': 'registration', 'pagrehistro': 'registration',
    'seguro': 'insurance', 'gamot': 'treatment', 'lunas': 'treatment',
    'treat': 'treatment', 'treating': 'treatment', 'paggamot': 'treatment',
    'alaga': 'care', 'natutuyo': 'dry', 'tuyo': 'dry', 'drying': 'dry',
    'pagpapatuyo': 'dry', 'pag-iimbak': 'storage', 'imbak': 'storage',
    'nabubulok': 'rot', 'bulok': 'rot', 'rotting': 'rot',
    'nalalanta': 'wilt', 'lanta': 'wilt', 'wilting': 'wilt',
    'kakulangan': 'deficiency', 'kulang': 'deficiency',
    'nitroheno': 'nitrogen', 'sustansya': 'nutrient', 'nutrients': 'nutrient',
    'daga': 'rat', 'rats': 'rat', 'uod': 'worm', 'worms': 'worm',
    'manok': 'chicken', 'chickens': 'chicken', 'baboy': 'pig', 'pigs': 'pig',
    'baka': 'cattle', 'kambing': 'goat', 'goats': 'goat',
    'kamatis': 'tomato', 'tomatoes': 'tomato', 'sibuyas': 'onion',
    'talong': 'eggplant', 'kalabasa': 'squash', 'okra': 'okra',
    'organiko': 'organic', 'composting': 'compost',
    'pananim': 'crop', 'crops': 'crop', 'sira': 'damage', 'damaged': 'damage',
    'pagpuksa': 'control', 'kontrol': 'control', 'proteksyon': 'protection',
    'pestisidyo': 'pesticide', 'pesticides': 'pesticide',
}
PHRASES = {
    'turning yellow': 'yellow', 'nagiging dilaw': 'yellow',
    'naninilaw na': 'yellow', 'pag lipat tanim': 'transplanting',
    'lipat tanim': 'transplanting', 'paglipat ng punla': 'transplanting seedling',
    'walang tubig': 'water deficiency', 'kulang sa tubig': 'water deficiency',
    'not enough water': 'water deficiency', 'low water': 'water deficiency',
    'walang ulan': 'drought', 'kakulangan sa ulan': 'drought',
    'pag aani': 'harvest', 'pag iimbak': 'storage',
    'fall army worm': 'fall armyworm', 'gintong kuhol': 'golden apple snail',
}


def tokens(value):
    if isinstance(value, (list, tuple, set)):
        value = ' '.join(str(item) for item in value)
    text = unicodedata.normalize('NFKD', str(value or '').lower())
    text = ''.join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"[^\w\s]", ' ', text)
    text = ' '.join(text.split())
    for phrase, replacement in sorted(PHRASES.items(), key=lambda row: -len(row[0])):
        text = re.sub(r'\b' + re.escape(phrase) + r'\b', replacement, text)
    return {TERMS.get(word, word) for word in text.split()
            if len(word) > 2 and word not in STOP_WORDS}


def rank_entries(entries, query):
    incoming = tokens(query)
    if not incoming:
        return []
    ranked = []
    for item in entries:
        primary = tokens([item.get('title', ''), item.get('question', ''),
                          *item.get('keywords', [])])
        answer = tokens(item.get('answer', ''))
        matched = incoming & (primary | answer)
        if not matched:
            continue
        # Answer-only hits have less weight than the subject of the article.
        coverage = (len(incoming & primary) + .5 * len((incoming & answer) - primary)) / len(incoming)
        percentage = max(1, round(coverage * 100))
        ranked.append({**item, 'matchPercentage': percentage,
                       'matchedTerms': sorted(matched), 'matchBasis': 'query-relevance'})
    return sorted(ranked, key=lambda row: (-row['matchPercentage'], row.get('title', '').lower(), row['id']))
