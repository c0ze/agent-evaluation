import unittest

from slugkit import normalize_version, slugify


class SlugkitTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_slugify_repeated_punctuation(self):
        self.assertEqual(slugify("Hello---World!!!"), "hello-world")
        self.assertEqual(slugify("...Hello..."), "hello")
        self.assertEqual(slugify("a  b"), "a-b")

    def test_normalize_version(self):
        # Ordinary spellings match distutils LooseVersion, including forms a
        # PEP 440 canonical parser would rewrite or reject.
        samples = (
            "1.2.0",
            "2.0rc1",
            "1.5.2b2",
            "2.0a1",
            "2.0b1",
            "8.02",
            "3.10a",
            "3.1.1.6",
            "10",
            "0.4.0",
        )
        for sample in samples:
            with self.subTest(sample=sample):
                self.assertEqual(normalize_version(sample), sample)


if __name__ == "__main__":
    unittest.main()
