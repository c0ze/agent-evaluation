import unittest

from slugkit import normalize_version, slugify


class SlugkitTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_slugify_repeated_punctuation(self):
        cases = [
            ("foo---bar...baz!!", "foo-bar-baz"),
            ("___hello___world___", "hello-world"),
            ("Release 0.4.0 (rc1)", "release-0-4-0-rc1"),
            ("---", ""),
            ("   ", ""),
        ]
        for raw, expected in cases:
            with self.subTest(raw=raw):
                self.assertEqual(slugify(raw), expected)

    def test_normalize_version_ordinary(self):
        cases = [
            ("1", "1"),
            ("1.2", "1.2"),
            ("1.2.0", "1.2.0"),
            ("0.4.0", "0.4.0"),
            ("10.20.30", "10.20.30"),
            ("2.0rc1", "2.0rc1"),
            ("1.2.3a1", "1.2.3a1"),
            ("1.2.3b2", "1.2.3b2"),
            ("1.2.3.post1", "1.2.3.post1"),
            ("1.2.3.dev1", "1.2.3.dev1"),
            ("1.2.3rc1.post2.dev3", "1.2.3rc1.post2.dev3"),
        ]
        for raw, expected in cases:
            with self.subTest(raw=raw):
                self.assertEqual(normalize_version(raw), expected)

    def test_normalize_version_canonicalization(self):
        cases = [
            (" 1.2.0 ", "1.2.0"),
            ("v1.2.0", "1.2.0"),
            ("V1.2.0", "1.2.0"),
            ("01.02.03", "1.2.3"),
            ("2.0-rc1", "2.0rc1"),
            ("1.0.0-alpha.1", "1.0.0a1"),
            ("1.0.0_beta_2", "1.0.0b2"),
            ("1.2.3c1", "1.2.3rc1"),
            ("1.2.3preview2", "1.2.3rc2"),
            ("2.0rc", "2.0rc0"),
            ("1.2.0-1", "1.2.0.post1"),
            ("1.2.0dev1", "1.2.0.dev1"),
            ("1.2.0+01.Foo-Bar", "1.2.0+1.foo.bar"),
            ("0!1.2.0", "1.2.0"),
            ("1!1.2.0", "1!1.2.0"),
        ]
        for raw, expected in cases:
            with self.subTest(raw=raw):
                self.assertEqual(normalize_version(raw), expected)

    def test_normalize_version_invalid(self):
        for bad in ["", "   ", "not-a-version", "1..2", "1.2.", ".1.2", "1.2.3a_", "1.2.3-foo"]:
            with self.subTest(bad=bad):
                with self.assertRaises(ValueError):
                    normalize_version(bad)

        for non_str in [None, 123]:
            with self.subTest(non_str=non_str):
                with self.assertRaises(TypeError):
                    normalize_version(non_str)  # type: ignore[arg-type]


if __name__ == "__main__":
    unittest.main()
