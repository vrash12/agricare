import unittest
from accounts.knowledge_search import tokens, rank_entries


class KnowledgeSearchTests(unittest.TestCase):
    def test_common_bilingual_phrases(self):
        pairs = [
            ('Why are my rice leaves turning yellow?', 'Bakit nagiging dilaw ang dahon ng palay?'),
            ('How should I treat wilting tomatoes?', 'Paano ang paggamot sa nalalanta na kamatis?'),
            ('Corn seed harvest', 'Pag-aani ng binhi ng mais'),
            ('Rice not enough water', 'Palay kulang sa tubig'),
        ]
        for english, tagalog in pairs:
            with self.subTest(query=tagalog):
                self.assertEqual(tokens(english), tokens(tagalog))

    def test_ranked_topic_hits_beat_answer_only_hits(self):
        articles = [
            {'id': 'body', 'title': 'General advice', 'answer': 'yellow rice leaf'},
            {'id': 'topic', 'title': 'Yellow rice leaves', 'answer': 'Consult LGU'},
        ]
        results = rank_entries(articles, 'Bakit naninilaw ang dahon ng palay?')
        self.assertEqual([r['id'] for r in results], ['topic', 'body'])
        self.assertEqual([r['matchPercentage'] for r in results], [100, 50])
        self.assertEqual(results[0]['matchBasis'], 'query-relevance')

    def test_empty_generic_and_unrelated_questions_return_no_results(self):
        article = {'id': 'rice', 'title': 'Rice seed', 'answer': 'Use healthy seed.'}
        for query in ('', 'paano po ba', 'spacecraft engine'):
            self.assertEqual(rank_entries([article], query), [])

    def test_seeded_faq_queries_find_expected_article(self):
        from pathlib import Path
        import runpy
        ARTICLES = runpy.run_path(str(Path(__file__).resolve().parents[1] / 'scripts' / 'seed_knowledge.py'))['ARTICLES']
        cases = {
            'Bakit naninilaw ang dahon ng palay?': 'agrixa-faq-rice-yellow-leaves',
            'Paano pumili ng binhi ng palay?': 'agrixa-faq-rice-seed-quality',
        }
        for query, expected in cases.items():
            with self.subTest(query=query):
                results = rank_entries(ARTICLES, query)
                self.assertIn(expected, [r['id'] for r in results[:5]])
                self.assertEqual([r['matchPercentage'] for r in results], sorted([r['matchPercentage'] for r in results], reverse=True))


if __name__ == '__main__':
    unittest.main()
