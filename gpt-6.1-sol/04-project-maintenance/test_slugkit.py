import unittest

from slugkit import normalize_version, slugify


class SlugkitTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_normalize_version(self):
        versions = (
            "1",
            "1.2",
            "1.2.0",
            "1.2.0.0",
            "01.002.0003",
            "1.0a1",
            "1.0b2",
            "2.0rc1",
            "2.0RC1",
            "1.0.dev3",
            "1.0.post4",
            "1.0+local.2",
        )
        for version in versions:
            with self.subTest(version=version):
                self.assertEqual(normalize_version(version), version)

    def test_slugify_repeated_punctuation(self):
        values = {
            "Hello...,,, World!!!": "hello-world",
            "---hello___world---": "hello-world",
            "!!!": "",
        }
        for value, expected in values.items():
            with self.subTest(value=value):
                self.assertEqual(slugify(value), expected)


if __name__ == "__main__":
    unittest.main()
