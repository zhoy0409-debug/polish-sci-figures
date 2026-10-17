"""Metric and geometry arithmetic; no invented real-image accuracy claims."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import hashlib
from PIL import Image
from evaluate_scientific_images import confusion, geometry, metric, evaluate


class EvaluationTests(unittest.TestCase):
    def test_confusion_and_uncertainty_include_negatives_and_undefined_precision(self):
        report=confusion([(True,True),(True,False),(False,True),(False,False)])
        self.assertEqual([report[k] for k in ('TP','FP','FN','TN')],[1,1,1,1])
        self.assertEqual(report['precision']['value'],.5)
        self.assertEqual(report['recallSensitivity']['value'],.5)
        self.assertEqual(report['specificity']['value'],.5)
        self.assertEqual(report['falsePositiveRate']['value'],.5)
        self.assertLess(report['precision']['ci95'][0],.5)
        self.assertGreater(report['precision']['ci95'][1],.5)
        self.assertIsNone(metric(0,0)['value'])
        self.assertIsNone(metric(0,0)['ci95'])
        self.assertGreater(metric(0,7)['ci95'][1],.35)

    def test_ordered_corner_errors_do_not_hide_mirror_or_shift(self):
        truth=[[.1,.2],[.6,.2],[.6,.7],[.1,.7]]
        exact=geometry(truth,truth,[1000,1000])
        self.assertAlmostEqual(exact['roiIoU'],1,places=5)
        self.assertEqual(exact['cornerMaxPixels'],0)
        mirrored=geometry([truth[i] for i in [1,0,3,2]],truth,[1000,1000])
        self.assertAlmostEqual(mirrored['roiIoU'],1,places=5)
        self.assertGreater(mirrored['cornerMaxPixels'],499)
        shifted=geometry([[x+.1,y] for x,y in truth],truth,[1000,1000])
        self.assertAlmostEqual(shifted['roiIoU'],2/3,places=5)
        self.assertAlmostEqual(shifted['cornerMeanPixels'],100,places=4)

    def test_unattested_independence_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            path=root/'manifest.json'
            path.write_text(json.dumps({'schema':'image-pair-evaluation/1',
                'studyType':'independent_real_case_blind','independentBlindStudy':True,'images':[],'pairs':[]}))
            with self.assertRaisesRegex(ValueError,'annotation protocol'):
                evaluate(path,root/'out.json')

    def test_engine_error_does_not_inflate_true_negative_or_coverage(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            image=root/'a.png'
            Image.new('RGB',(100,100),'white').save(image)
            source={'path':'a.png','sha256':hashlib.sha256(image.read_bytes()).hexdigest()}
            manifest={'schema':'image-pair-evaluation/1','studyType':'engineered_real_source',
                'images':[{'id':'a',**source},{'id':'b',**source}],
                'pairs':[{'id':'negative','stratum':'test','a':'a','b':'b','duplicate':False,'localization':{'positive':False}}]}
            path=root/'manifest.json'
            path.write_text(json.dumps(manifest))
            with patch('evaluate_scientific_images.duplicate.scan_images',side_effect=ValueError('unsupported input')):
                output=evaluate(path,root/'out.json')
            self.assertEqual(output['summary']['overall']['duplicate']['TN'],0)
            self.assertEqual(output['summary']['overall']['nonEvaluablePairs'],1)
            self.assertEqual(output['summary']['overall']['successfulScreeningCoverage']['value'],0)
            self.assertEqual(output['failures'][0]['type'],'engine_error')


if __name__=='__main__':
    unittest.main(verbosity=2)
