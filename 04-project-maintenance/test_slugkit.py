import pathlib
import subprocess
import sys
import unittest

from slugkit import normalize_version, slugify

ROOT = pathlib.Path(__file__).resolve().parent


class SlugkitTests(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("  Hello, World! "), "hello-world")

    def test_slugify_collapses_repeated_punctuation(self):
        self.assertEqual(slugify("a!!!b???c"), "a-b-c")
        self.assertEqual(slugify("--Hello...World--"), "hello-world")

    def test_normalize_version(self):
        self.assertEqual(normalize_version("1.2.0"), "1.2.0")
        self.assertEqual(normalize_version("2.0rc1"), "2.0rc1")
        self.assertEqual(normalize_version("1.10.3"), "1.10.3")
        self.assertEqual(normalize_version("1.0.0.post1"), "1.0.0.post1")

    def test_does_not_import_distutils(self):
        # -S keeps site-packages out, so a setuptools distutils shim cannot mask an import.
        code = "import sys, slugkit; print('distutils' in sys.modules)"
        result = subprocess.run(
            [sys.executable, "-B", "-S", "-c", code],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        self.assertEqual(result.stdout.strip(), "False")


if __name__ == "__main__":
    unittest.main()

