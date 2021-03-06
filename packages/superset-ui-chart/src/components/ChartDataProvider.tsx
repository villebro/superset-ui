/* eslint react/sort-comp: 'off' */
import React, { ReactNode } from 'react';
import { SupersetClientInterface, RequestConfig } from '@superset-ui/connection';
import { QueryFormData, Datasource } from '@superset-ui/query';
import ChartClient, { SliceIdAndOrFormData } from '../clients/ChartClient';
import { QueryData } from '../models/ChartProps';

interface Payload {
  formData: Partial<QueryFormData>;
  queryData: QueryData;
  datasource?: Datasource;
}

export interface ProvidedProps {
  payload?: Payload;
  error?: Error;
  loading?: boolean;
}

export type Props =
  /** User can pass either one or both of sliceId or formData */
  SliceIdAndOrFormData & {
    /** Child function called with ProvidedProps */
    children: (provided: ProvidedProps) => ReactNode;
    /** Superset client which is used to fetch data. It should already be configured and initialized. */
    client?: SupersetClientInterface;
    /** Will fetch and include datasource metadata for SliceIdAndOrFormData in the payload. */
    loadDatasource?: boolean;
    /** Callback when an error occurs. Enables wrapping the Provider in an ErrorBoundary. */
    onError?: (error: ProvidedProps['error']) => void;
    /** Callback when data is loaded. */
    onLoaded?: (payload: ProvidedProps['payload']) => void;
    /** Hook to override the formData request config. */
    formDataRequestOptions?: Partial<RequestConfig>;
    /** Hook to override the datasource request config. */
    datasourceRequestOptions?: Partial<RequestConfig>;
    /** Hook to override the queryData request config. */
    queryRequestOptions?: Partial<RequestConfig>;
  };

type State = {
  status: 'uninitialized' | 'loading' | 'error' | 'loaded';
  payload?: ProvidedProps['payload'];
  error?: ProvidedProps['error'];
};

class ChartDataProvider extends React.PureComponent<Props, State> {
  readonly chartClient: ChartClient;

  state: State = { status: 'uninitialized' };

  constructor(props: Props) {
    super(props);
    this.chartClient = new ChartClient({ client: props.client });
  }

  componentDidMount() {
    this.handleFetchData();
  }

  componentDidUpdate(prevProps: Props) {
    const { formData, sliceId } = this.props;
    if (formData !== prevProps.formData || sliceId !== prevProps.sliceId) {
      this.handleFetchData();
    }
  }

  private extractSliceIdAndFormData() {
    const { formData, sliceId } = this.props;

    return formData ? { formData } : { sliceId: sliceId! };
  }

  private handleFetchData = () => {
    const {
      loadDatasource,
      formDataRequestOptions,
      datasourceRequestOptions,
      queryRequestOptions,
    } = this.props;

    this.setState({ status: 'loading' }, () => {
      try {
        this.chartClient
          .loadFormData(this.extractSliceIdAndFormData(), formDataRequestOptions)
          .then(formData =>
            Promise.all([
              loadDatasource
                ? this.chartClient.loadDatasource(formData.datasource, datasourceRequestOptions)
                : Promise.resolve(undefined),
              this.chartClient.loadQueryData(formData, queryRequestOptions),
            ]).then(
              ([datasource, queryData]) =>
                // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                ({
                  datasource,
                  formData,
                  queryData,
                } as Payload),
            ),
          )
          .then(this.handleReceiveData)
          .catch(this.handleError);
      } catch (error) {
        this.handleError(error);
      }
    });
  };

  private handleReceiveData = (payload?: Payload) => {
    const { onLoaded } = this.props;
    if (onLoaded) onLoaded(payload);
    this.setState({ payload, status: 'loaded' });
  };

  private handleError = (error: ProvidedProps['error']) => {
    const { onError } = this.props;
    if (onError) onError(error);
    this.setState({ error, status: 'error' });
  };

  render() {
    const { children } = this.props;
    const { status, payload, error } = this.state;

    switch (status) {
      case 'loading':
        return children({ loading: true });
      case 'loaded':
        return children({ payload });
      case 'error':
        return children({ error });
      case 'uninitialized':
      default:
        return null;
    }
  }
}

export default ChartDataProvider;
