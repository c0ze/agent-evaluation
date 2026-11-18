import unittest

from slugkit import normalize_version, slugify


class SlugkitTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_slugify_repeated_punctuation(self):
        self.assertEqual(slugify("...Hello?!...World!!!"), "hello-world")

    def test_normalize_version_preserves_dotted_spelling(self):
        for value in ("1", "1.2.0", "01.002.0"):
            with self.subTest(value=value):
                self.assertEqual(normalize_version(value), value)

    def test_normalize_version_preserves_suffix_spelling(self):
        for value in ("2.0rc1", "1.0-RC01", "3.1.0-beta.2", "1.2.3+build.04"):
            with self.subTest(value=value):
                self.assertEqual(normalize_version(value), value)


if __name__ == "__main__":
    unittest.main()
