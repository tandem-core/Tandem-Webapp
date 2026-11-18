import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import pipeline


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.data = patch.object(pipeline, 'DATA', Path(self.temp.name))
        self.data.start()
        self.segments = [{'idx': 0, 'start': 0.0, 'end': 4.0, 'text': 'Take 15 mg daily for two weeks.'}]
        self.result = {'summary': 'A dose change was discussed.', 'medications': [{
            'id': 'm1', 'heardAs': 'unclear name', 'suggestedName': None,
            'nameState': 'unverified', 'role': 'dose_change', 'detail': 'You discussed a lower dose.', 'evidence': [0],
            'doses': [{'text': '15 mg daily for two weeks', 'amount': '15', 'unit': 'mg', 'frequency': 'daily', 'evidence': [0]}],
        }], 'actionItems': []}

    def tearDown(self):
        self.data.stop()
        self.temp.cleanup()

    def test_valid_evidence(self):
        pipeline.validate_result(self.result, self.segments)

    def test_missing_evidence_rejected(self):
        self.result['medications'][0]['evidence'] = []
        with self.assertRaises(ValueError):
            pipeline.validate_result(self.result, self.segments)

    def test_unknown_segment_rejected(self):
        self.result['medications'][0]['doses'][0]['evidence'] = [99]
        with self.assertRaises(ValueError):
            pipeline.validate_result(self.result, self.segments)

    def test_invented_amount_rejected(self):
        self.result['medications'][0]['doses'][0]['amount'] = '100'
        with self.assertRaises(ValueError):
            pipeline.validate_result(self.result, self.segments)

    def test_invalid_timestamps_rejected(self):
        self.segments[0]['end'] = -1
        with self.assertRaises(ValueError):
            pipeline.validate_result(self.result, self.segments)

    def test_duplicate_ids_rejected(self):
        self.result['medications'].append(copy.deepcopy(self.result['medications'][0]))
        with self.assertRaises(ValueError):
            pipeline.validate_result(self.result, self.segments)

    def test_all_fixtures_validate(self):
        for path in sorted((pipeline.ROOT / 'demo-data/conversations').glob('*.json')):
            segments, result = pipeline.replay(path.stem)
            pipeline.validate_result(result, segments)

    def test_past_error_not_new_prescription(self):
        _, result = pipeline.replay('clip_05_anticoagulant_medication_error')
        self.assertEqual(result['medications'][0]['role'], 'past_error')
        self.assertIsNone(result['medications'][0]['doses'][0]['amount'])

    def test_uncertain_name_not_silently_confirmed(self):
        _, result = pipeline.replay('clip_01_medication_shared_decision')
        self.assertEqual(result['medications'][0]['nameState'], 'unverified')
        self.assertEqual(result['medications'][1]['role'], 'not_chosen')

    def test_missing_key_is_recorded_failure(self):
        job = pipeline.create_job('Test', 'live', b'audio')
        with patch.dict(pipeline.os.environ, {}, clear=True):
            pipeline.run_job(job)
        saved = pipeline.get_job(job)
        self.assertEqual(saved['status'], 'failed')
        self.assertIn('OPENAI_API_KEY', saved['error'])
        self.assertIsNone(saved['result'])

    def test_successful_run_persists_segments_and_doses(self):
        job = pipeline.create_job('Test', 'replay', b'audio')
        with patch.object(pipeline, 'replay', return_value=(self.segments, self.result)), patch.object(pipeline, 'make_clips'):
            pipeline.run_job(job, 'fixture')
        saved = pipeline.get_job(job)
        self.assertEqual(saved['status'], 'completed')
        self.assertEqual(saved['model'], 'fixture-replay')
        self.assertEqual(saved['result']['medications'][0]['doses'][0]['amount'], '15')
        with pipeline.connect() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM transcript_segments').fetchone()[0], 1)
            self.assertEqual(db.execute('SELECT COUNT(*) FROM medications').fetchone()[0], 1)

    def test_failure_does_not_publish_partial_results(self):
        job = pipeline.create_job('Test', 'replay', b'audio')
        self.result['medications'][0]['evidence'] = [999]
        with patch.object(pipeline, 'replay', return_value=(self.segments, self.result)):
            pipeline.run_job(job, 'fixture')
        self.assertEqual(pipeline.get_job(job)['status'], 'failed')
        with pipeline.connect() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM medications').fetchone()[0], 0)

    def test_empty_audio_rejected(self):
        with self.assertRaises(ValueError):
            pipeline.create_job('Test', 'live', b'')

    def test_schema_rejects_missing_fields(self):
        del self.result['medications'][0]['doses'][0]['unit']
        with self.assertRaises(ValueError):
            pipeline.validate_result(self.result, self.segments)

    def test_dose_cannot_match_part_of_another_number(self):
        self.segments[0]['text'] = 'Take 150 mg daily for two weeks.'
        with self.assertRaises(ValueError):
            pipeline.validate_result(self.result, self.segments)

    def test_model_refusal_is_not_a_success(self):
        with patch.object(pipeline, 'api', return_value={'status': 'completed', 'output': [{'content': [{'type': 'refusal', 'refusal': 'No'}]}]}):
            with self.assertRaises(ValueError):
                pipeline.extract(self.segments)

    def test_extraction_uses_strict_schema(self):
        response = {'status': 'completed', 'output': [{'content': [{'type': 'output_text', 'text': json.dumps(self.result)}]}]}
        with patch.object(pipeline, 'api', return_value=response) as call:
            result, model = pipeline.extract(self.segments)
        request = json.loads(call.call_args[0][1])
        self.assertTrue(request['text']['format']['strict'])
        self.assertEqual(result, self.result)
        self.assertTrue(model)


if __name__ == '__main__':
    unittest.main()
