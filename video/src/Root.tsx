import {Composition} from 'remotion';
import {PHARE_DEMO, PhareDemo} from './PhareDemo';

export const Root: React.FC = () => <Composition id="PhareDemo" component={PhareDemo} {...PHARE_DEMO} />;
