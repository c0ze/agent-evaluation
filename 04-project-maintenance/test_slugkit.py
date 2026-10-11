import unittest

from slugkit import normalize_version, slugify


class SlugifyTests(unittest.TestCase):
    def test_basic(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_repeated_punctuation_collapsed(self):
        self.assertEqual(slugify("Hello---World"), "hello-world")
        self.assertEqual(slugify("a, ,b!"), "a-b")

    def test_strips_leading_and_trailing_separators(self):
        self.assertEqual(slugify("!!!hello???"), "hello")

    def test_no_alphanumerics(self):
        self.assertEqual(slugify("!!!"), "")


class NormalizeVersionTests(unittest.TestCase):
    def test_ordinary_versions_unchanged(self):
        for value in ("1.2.0", "2.0rc1", "0.4.0", "3.10.13", "1.0b2", "2.0dev"):
            with self.subTest(value=value):
                self.assertEqual(normalize_version(value), value)

    def test_invalid_version_raises_value_error(self):
        for value in ("", "not-a-version", "1..2", "1.2.", "-1.2", "1.2 ", " 1.2", "v1.2"):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    normalize_version(value)

    def test_non_string_raises_type_error(self):
        for value in (None, 1, 1.2, ["1.2.0"]):
            with self.subTest(value=value):
                with self.assertRaises(TypeError):
                    normalize_version(value)


if __name__ == "__main__":
    unittest.main()
