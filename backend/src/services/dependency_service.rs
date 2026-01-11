use anyhow::Result;
use serde_json::Value;
use std::collections::{HashSet, VecDeque};

use crate::models::{DependencyEdge, DependencyGraph, DependencyNode};
use crate::services::scan_service::ScanService;

pub struct DependencyService;

impl DependencyService {
    /// 依存関係グラフを取得する
    pub async fn get_dependencies(scan_id: &str, root_id: Option<&str>) -> Result<DependencyGraph> {
        let scan_data = ScanService::get_scan_data(scan_id)
            .await
            .ok_or_else(|| anyhow::anyhow!("Scan not found"))?;

        let provider = scan_data
            .get("provider")
            .and_then(|p| p.as_str())
            .unwrap_or("aws");

        match provider {
            "aws" => Self::extract_aws_dependencies(&scan_data, root_id),
            "azure" => Self::extract_azure_dependencies(&scan_data, root_id),
            _ => Ok(DependencyGraph {
                nodes: vec![],
                edges: vec![],
            }),
        }
    }

    /// AWS IAMリソースの依存関係を抽出する
    fn extract_aws_dependencies(
        scan_data: &Value,
        root_id: Option<&str>,
    ) -> Result<DependencyGraph> {
        let mut nodes = Vec::new();
        let mut edges = Vec::new();

        // ユーザーノードを追加
        if let Some(users) = scan_data.get("users").and_then(|u| u.as_array()) {
            for user in users {
                if let Some(name) = user.get("user_name").and_then(|n| n.as_str()) {
                    nodes.push(DependencyNode {
                        id: format!("user:{}", name),
                        node_type: "user".to_string(),
                        name: name.to_string(),
                        data: user.clone(),
                    });
                }
            }
        }

        // グループノードを追加
        if let Some(groups) = scan_data.get("groups").and_then(|g| g.as_array()) {
            for group in groups {
                if let Some(name) = group.get("group_name").and_then(|n| n.as_str()) {
                    nodes.push(DependencyNode {
                        id: format!("group:{}", name),
                        node_type: "group".to_string(),
                        name: name.to_string(),
                        data: group.clone(),
                    });
                }
            }
        }

        // ロールノードを追加
        if let Some(roles) = scan_data.get("roles").and_then(|r| r.as_array()) {
            for role in roles {
                if let Some(name) = role.get("role_name").and_then(|n| n.as_str()) {
                    nodes.push(DependencyNode {
                        id: format!("role:{}", name),
                        node_type: "role".to_string(),
                        name: name.to_string(),
                        data: role.clone(),
                    });
                }
            }
        }

        // ポリシーノードを追加
        if let Some(policies) = scan_data.get("policies").and_then(|p| p.as_array()) {
            for policy in policies {
                if let Some(arn) = policy.get("arn").and_then(|a| a.as_str()) {
                    let name = policy
                        .get("policy_name")
                        .and_then(|n| n.as_str())
                        .unwrap_or(arn);
                    nodes.push(DependencyNode {
                        id: format!("policy:{}", arn),
                        node_type: "policy".to_string(),
                        name: name.to_string(),
                        data: policy.clone(),
                    });
                }
            }
        }

        // アタッチメントからエッジを作成
        if let Some(attachments) = scan_data.get("attachments").and_then(|a| a.as_array()) {
            for attachment in attachments {
                let entity_type = attachment
                    .get("entity_type")
                    .and_then(|e| e.as_str())
                    .unwrap_or("");
                let entity_name = attachment
                    .get("entity_name")
                    .and_then(|e| e.as_str())
                    .unwrap_or("");
                let policy_arn = attachment
                    .get("policy_arn")
                    .and_then(|p| p.as_str())
                    .unwrap_or("");

                let source_id = match entity_type {
                    "User" => format!("user:{}", entity_name),
                    "Group" => format!("group:{}", entity_name),
                    "Role" => format!("role:{}", entity_name),
                    _ => continue,
                };

                edges.push(DependencyEdge {
                    source: source_id,
                    target: format!("policy:{}", policy_arn),
                    edge_type: "policy_attachment".to_string(),
                    label: Some("has policy".to_string()),
                });
            }
        }

        // グループメンバーシップのエッジを作成
        if let Some(groups) = scan_data.get("groups").and_then(|g| g.as_array()) {
            for group in groups {
                if let Some(group_name) = group.get("group_name").and_then(|n| n.as_str()) {
                    if let Some(members) = group.get("members").and_then(|m| m.as_array()) {
                        for member in members {
                            if let Some(user_name) = member.as_str() {
                                edges.push(DependencyEdge {
                                    source: format!("user:{}", user_name),
                                    target: format!("group:{}", group_name),
                                    edge_type: "group_membership".to_string(),
                                    label: Some("member of".to_string()),
                                });
                            }
                        }
                    }
                }
            }
        }

        // ルートIDでフィルタリング
        if let Some(root) = root_id {
            Self::filter_by_root(&mut nodes, &mut edges, root);
        }

        Ok(DependencyGraph { nodes, edges })
    }

    /// Azure IAMリソースの依存関係を抽出する
    fn extract_azure_dependencies(
        scan_data: &Value,
        root_id: Option<&str>,
    ) -> Result<DependencyGraph> {
        let mut nodes = Vec::new();
        let mut edges = Vec::new();

        // ロール定義ノードを追加
        if let Some(role_definitions) = scan_data.get("role_definitions").and_then(|r| r.as_array())
        {
            for role_def in role_definitions {
                if let Some(id) = role_def.get("id").and_then(|i| i.as_str()) {
                    let name = role_def.get("name").and_then(|n| n.as_str()).unwrap_or(id);
                    nodes.push(DependencyNode {
                        id: format!("role_definition:{}", id),
                        node_type: "role_definition".to_string(),
                        name: name.to_string(),
                        data: role_def.clone(),
                    });
                }
            }
        }

        // ロール割り当てからノードとエッジを作成
        if let Some(role_assignments) = scan_data.get("role_assignments").and_then(|r| r.as_array())
        {
            for assignment in role_assignments {
                if let (Some(principal_id), Some(role_def_id)) = (
                    assignment.get("principal_id").and_then(|p| p.as_str()),
                    assignment
                        .get("role_definition_id")
                        .and_then(|r| r.as_str()),
                ) {
                    // プリンシパルノードを追加（存在しない場合）
                    let principal_node_id = format!("principal:{}", principal_id);
                    let principal_name = assignment
                        .get("principal_name")
                        .and_then(|n| n.as_str())
                        .unwrap_or(principal_id);

                    if !nodes.iter().any(|n| n.id == principal_node_id) {
                        nodes.push(DependencyNode {
                            id: principal_node_id.clone(),
                            node_type: "principal".to_string(),
                            name: principal_name.to_string(),
                            data: assignment.clone(),
                        });
                    }

                    // エッジを追加
                    edges.push(DependencyEdge {
                        source: principal_node_id,
                        target: format!("role_definition:{}", role_def_id),
                        edge_type: "role_assignment".to_string(),
                        label: Some("assigned".to_string()),
                    });
                }
            }
        }

        // ルートIDでフィルタリング
        if let Some(root) = root_id {
            Self::filter_by_root(&mut nodes, &mut edges, root);
        }

        Ok(DependencyGraph { nodes, edges })
    }

    /// root_idから到達可能なノードのみを残す（BFS使用）
    fn filter_by_root(
        nodes: &mut Vec<DependencyNode>,
        edges: &mut Vec<DependencyEdge>,
        root_id: &str,
    ) {
        let mut reachable: HashSet<String> = HashSet::new();
        let mut queue: VecDeque<String> = VecDeque::new();

        queue.push_back(root_id.to_string());

        while let Some(current) = queue.pop_front() {
            if reachable.contains(&current) {
                continue;
            }
            reachable.insert(current.clone());

            for edge in edges.iter() {
                if edge.source == current && !reachable.contains(&edge.target) {
                    queue.push_back(edge.target.clone());
                }
                if edge.target == current && !reachable.contains(&edge.source) {
                    queue.push_back(edge.source.clone());
                }
            }
        }

        nodes.retain(|n| reachable.contains(&n.id));
        edges.retain(|e| reachable.contains(&e.source) && reachable.contains(&e.target));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_extract_aws_dependencies() {
        let scan_data = json!({
            "provider": "aws",
            "users": [
                {"user_name": "alice"},
                {"user_name": "bob"}
            ],
            "groups": [
                {"group_name": "admins", "members": ["alice"]},
                {"group_name": "developers", "members": ["bob"]}
            ],
            "roles": [
                {"role_name": "admin-role"}
            ],
            "policies": [
                {"arn": "arn:aws:iam::123:policy/AdminPolicy", "policy_name": "AdminPolicy"}
            ],
            "attachments": [
                {"entity_type": "User", "entity_name": "alice", "policy_arn": "arn:aws:iam::123:policy/AdminPolicy"},
                {"entity_type": "Group", "entity_name": "admins", "policy_arn": "arn:aws:iam::123:policy/AdminPolicy"}
            ]
        });

        let result = DependencyService::extract_aws_dependencies(&scan_data, None).unwrap();

        assert_eq!(result.nodes.len(), 6); // 2 users + 2 groups + 1 role + 1 policy
        assert_eq!(result.edges.len(), 4); // 2 policy attachments + 2 group memberships
    }

    #[test]
    fn test_filter_by_root() {
        let mut nodes = vec![
            DependencyNode {
                id: "user:alice".to_string(),
                node_type: "user".to_string(),
                name: "alice".to_string(),
                data: json!({}),
            },
            DependencyNode {
                id: "user:bob".to_string(),
                node_type: "user".to_string(),
                name: "bob".to_string(),
                data: json!({}),
            },
            DependencyNode {
                id: "policy:p1".to_string(),
                node_type: "policy".to_string(),
                name: "p1".to_string(),
                data: json!({}),
            },
        ];

        let mut edges = vec![DependencyEdge {
            source: "user:alice".to_string(),
            target: "policy:p1".to_string(),
            edge_type: "policy_attachment".to_string(),
            label: Some("has policy".to_string()),
        }];

        DependencyService::filter_by_root(&mut nodes, &mut edges, "user:alice");

        assert_eq!(nodes.len(), 2); // alice and p1
        assert_eq!(edges.len(), 1);
    }
}
