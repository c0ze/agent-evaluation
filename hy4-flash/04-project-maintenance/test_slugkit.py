import unittest

from slugkit import normalize_version, slugify


class SlugkitTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_normalize_version(self):
        self.assertEqual(normalize_version("1.2.0"), "1.2.0")
        self.assertEqual(normalize_version("2.0rc1"), "2.0rc1")

    def test_normalize_version_preserves_ordinary_versions(self):
        # Ordinary dotted versions (with pre/post/dev/local suffixes) must keep
        # the same observable string output as the old LooseVersion-based code.
        cases = [
            "0.4.0",
            "1.2",
            "1.2.3.4",
            "2.0a1",
            "2.0b2",
            "2.0.post1",
            "1.2.0.dev3",
            "1.2+local.1",
            "1!2.0",
        ]
        for version in cases:
            with self.subTest(version=version):
                self.assertEqual(normalize_version(version), version)

    def test_normalize_version_unparseable_input_is_returned_verbatim(self):
        # LooseVersion accepted arbitrary strings and echoed them back; keep
        # that permissive behaviour for inputs packaging cannot parse at all.
        for value in ["not-a-version", "garbage", "1..2"]:
            with self.subTest(value=value):
                self.assertEqual(normalize_version(value), value)


if __name__ == "__main__":
    unittest.main()
