import { initWidget } from './linear-transform';
import { el } from './web-ui-common/dom';

const widgetContainer = el(document, '#linear-transform-widget');
if (!(widgetContainer instanceof HTMLDivElement)) {
  throw new Error('Widget container must be an HTMLDivElement');
}
initWidget(widgetContainer);
