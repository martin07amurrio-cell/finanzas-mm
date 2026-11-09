import unittest

from app.auth import hash_pin, verify_pin


class PinHashTests(unittest.TestCase):
    def test_correct_pin(self):
        pin_hash = hash_pin("562384")
        self.assertTrue(verify_pin(pin_hash, "562384"))
        self.assertFalse(verify_pin(pin_hash, "562385"))

    def test_distinct_salt(self):
        self.assertNotEqual(hash_pin("562384"), hash_pin("562384"))

    def test_plaintext_is_rejected(self):
        self.assertFalse(verify_pin("562384", "562384"))

    def test_short_pin_is_rejected(self):
        with self.assertRaises(ValueError):
            hash_pin("1234")

    def test_corrupt_hash_is_rejected(self):
        self.assertFalse(verify_pin("pbkdf2_sha256$0$zz$zz", "562384"))


if __name__ == "__main__":
    unittest.main()
