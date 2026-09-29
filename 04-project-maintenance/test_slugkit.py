import unittest

from slugkit import normalize_version, slugify


class SlugkitTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_slugify_repeated_punctuation(self):
        cases = (
            ("Hello...,,,World!!!", "hello-world"),
            (" --Hello___ / World-- ", "hello-world"),
            ("already--a---slug", "already-a-slug"),
            ("!!!...___", ""),
        )
        for value, expected in cases:
            with self.subTest(value=value):
                self.assertEqual(slugify(value), expected)

    def test_normalize_version_release_spelling(self):
        for value in ("0", "1.2", "1.2.0", "1.2.0.0", "01.002.000"):
            with self.subTest(value=value):
                self.assertEqual(normalize_version(value), value)

    def test_normalize_version_prerelease_spelling(self):
        for value in ("2.0rc1", "1.0a2", "1.0beta2", "1.0-RC1", "1.0-rc.1"):
            with self.subTest(value=value):
                self.assertEqual(normalize_version(value), value)

    def test_normalize_version_development_and_build_spelling(self):
        for value in ("1.0.dev3", "1.0.post1", "1.0+build.007"):
            with self.subTest(value=value):
                self.assertEqual(normalize_version(value), value)

    def test_normalize_version_preserves_prefix_and_whitespace(self):
        for value in ("v1.2.0", " 1.2.0 "):
            with self.subTest(value=value):
                self.assertEqual(normalize_version(value), value)


if __name__ == "__main__":
    unittest.main()
