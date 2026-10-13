import unittest

from slugkit import normalize_version, slugify


class SlugkitTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_slugify_repeated_punctuation(self):
        self.assertEqual(slugify("Hello... World!!!"), "hello-world")
        self.assertEqual(slugify("one...two,,three"), "one-two-three")
        self.assertEqual(slugify("a---b___c"), "a-b-c")

    def test_normalize_version(self):
        self.assertEqual(normalize_version("1.2.0"), "1.2.0")
        self.assertEqual(normalize_version("2.0rc1"), "2.0rc1")

    def test_normalize_version_ordinary_versions(self):
        cases = {
            "0.4.0": "0.4.0",
            "1.0": "1.0",
            "1.10.3": "1.10.3",
            "1.0a1": "1.0a1",
            "1.0b2": "1.0b2",
            "3.10.0": "3.10.0",
        }
        for raw, expected in cases.items():
            with self.subTest(raw=raw):
                self.assertEqual(normalize_version(raw), expected)

    def test_normalize_version_strips_whitespace(self):
        self.assertEqual(normalize_version(" 1.2.3 "), "1.2.3")

    def test_normalize_version_invalid(self):
        for raw in ("", "abc", "1..2"):
            with self.subTest(raw=raw):
                with self.assertRaises(ValueError):
                    normalize_version(raw)


if __name__ == "__main__":
    unittest.main()
