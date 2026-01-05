/**
 * テスト用モックデータ
 *
 * テストで使用する各種モックデータを提供します。
 */

import { Resource, ScanStatus, ConnectionStatus } from '../types';

/**
 * サンプルIAMユーザー
 */
export const mockIAMUser: Resource = {
  id: 'AIDATEST123',
  type: 'aws_iam_user',
  name: 'test-user',
  arn: 'arn:aws:iam::123456789012:user/test-user',
  attributes: {
    path: '/',
    created_at: '2024-01-01T00:00:00Z',
  },
  selected: false,
};

/**
 * サンプルIAMグループ
 */
export const mockIAMGroup: Resource = {
  id: 'AGPATEST456',
  type: 'aws_iam_group',
  name: 'test-group',
  arn: 'arn:aws:iam::123456789012:group/test-group',
  attributes: {
    path: '/',
    created_at: '2024-01-01T00:00:00Z',
  },
  selected: false,
};

/**
 * サンプルIAMロール
 */
export const mockIAMRole: Resource = {
  id: 'AROATEST789',
  type: 'aws_iam_role',
  name: 'test-role',
  arn: 'arn:aws:iam::123456789012:role/test-role',
  attributes: {
    path: '/',
    created_at: '2024-01-01T00:00:00Z',
    assume_role_policy_document: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { Service: 'lambda.amazonaws.com' },
          Action: 'sts:AssumeRole',
        },
      ],
    }),
  },
  selected: false,
};

/**
 * サンプルIAMポリシー
 */
export const mockIAMPolicy: Resource = {
  id: 'ANPATEST012',
  type: 'aws_iam_policy',
  name: 'test-policy',
  arn: 'arn:aws:iam::123456789012:policy/test-policy',
  attributes: {
    path: '/',
    created_at: '2024-01-01T00:00:00Z',
    default_version_id: 'v1',
    policy_document: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['s3:GetObject', 's3:PutObject'],
          Resource: 'arn:aws:s3:::my-bucket/*',
        },
      ],
    }),
  },
  selected: false,
};

/**
 * サンプルリソースリスト
 */
export const mockResources: Resource[] = [
  mockIAMUser,
  mockIAMGroup,
  mockIAMRole,
  mockIAMPolicy,
];

/**
 * サンプルスキャンステータス（進行中）
 */
export const mockScanStatusInProgress: ScanStatus = {
  status: 'in_progress',
  progress: 50,
  message: 'Scanning IAM resources...',
};

/**
 * サンプルスキャンステータス（完了）
 */
export const mockScanStatusCompleted: ScanStatus = {
  status: 'completed',
  progress: 100,
  message: 'Scan completed successfully',
  resources: mockResources,
};

/**
 * サンプルスキャンステータス（エラー）
 */
export const mockScanStatusFailed: ScanStatus = {
  status: 'failed',
  progress: 0,
  message: 'Scan failed: Authentication error',
  error: 'Authentication failed',
};

/**
 * サンプル接続ステータス（AWS）
 */
export const mockAWSConnectionStatus: ConnectionStatus = {
  provider: 'aws',
  connected: true,
  message: 'Connected successfully',
  profile: 'default',
  region: 'us-east-1',
};

/**
 * サンプル接続ステータス（Azure）
 */
export const mockAzureConnectionStatus: ConnectionStatus = {
  provider: 'azure',
  connected: true,
  message: 'Connected successfully',
  subscription: 'test-subscription',
};

/**
 * サンプルTerraform生成レスポンス
 */
export const mockTerraformGenerateResponse = {
  generation_id: 'gen-12345',
  message: 'Terraform code generated successfully',
  files: [
    'main.tf',
    'variables.tf',
    'outputs.tf',
    'iam_users.tf',
    'iam_groups.tf',
    'iam_roles.tf',
    'iam_policies.tf',
    'import.sh',
    'README.md',
  ],
};

/**
 * サンプルTerraformプレビュー
 */
export const mockTerraformPreview = {
  'main.tf': `terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}`,
  'iam_users.tf': `resource "aws_iam_user" "test_user" {
  name = "test-user"
  path = "/"

  tags = {
    Name = "test-user"
  }
}`,
};

/**
 * モックAPIレスポンスを作成するヘルパー
 */
export function createMockResponse<T>(data: T, delay = 100): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(data), delay);
  });
}

/**
 * モックエラーレスポンスを作成するヘルパー
 */
export function createMockError(
  message: string,
  delay = 100
): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), delay);
  });
}
